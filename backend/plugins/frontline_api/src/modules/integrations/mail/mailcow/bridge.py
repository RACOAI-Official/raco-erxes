"""Mailcow IMAP -> existing signed CRM email webhook; Python 3.10+, stdlib only."""
import email.policy
import hashlib
import hmac
import html
import imaplib
import json
import os
import ssl
import time
import urllib.request
from email.parser import BytesParser
from email.utils import getaddresses
from pathlib import Path
from urllib.parse import urlsplit
import base64


def payload_for(raw, destination):
    message = BytesParser(policy=email.policy.default).parsebytes(raw)
    sender = getaddresses(message.get_all('From', []))
    body = message.get_body(preferencelist=('html', 'plain'))
    content = body.get_content() if body else ''
    if not body or body.get_content_type() != 'text/html':
        content = '<pre>' + html.escape(content) + '</pre>'
    attachments = []
    for part in message.iter_attachments():
        data = part.get_payload(decode=True)
        if data is not None:
            attachments.append({
                'filename': part.get_filename() or 'attachment',
                'mimeType': part.get_content_type(),
                'contentId': str(part.get('Content-ID', '')).strip('<>'),
                'disposition': part.get_content_disposition() or 'attachment',
                'content': base64.b64encode(data).decode('ascii'), 'size': len(data),
            })
    addresses = lambda field: [
        {'name': name, 'address': address}
        for name, address in getaddresses(message.get_all(field, []))
    ]
    return {
        'to': destination,
        'messageId': str(message.get('Message-ID') or
                         '<mailcow-' + hashlib.sha256(raw).hexdigest() + '>'),
        'inReplyTo': str(message.get('In-Reply-To', '')),
        'references': str(message.get('References', '')).split(),
        'from': {'name': sender[0][0], 'address': sender[0][1]} if sender else {},
        'subject': str(message.get('Subject', '')),
        'html': content, 'recipients': addresses('To'), 'cc': addresses('Cc'),
        'headers': {key.lower(): str(value) for key, value in message.items()},
        'attachments': attachments,
    }


def deliver(url, key, payload):
    target = urlsplit(url)
    if target.scheme != 'https' and not (
        target.scheme == 'http' and target.hostname in ('localhost', '127.0.0.1')
    ):
        raise ValueError('CRM webhook requires HTTPS outside localhost')
    raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    timestamp = str(int(time.time()))
    signature = hmac.new(key.encode(), timestamp.encode() + b'.' + raw,
                         hashlib.sha256).hexdigest()
    request = urllib.request.Request(url, data=raw, headers={
        'Content-Type': 'application/json', 'x-erxes-timestamp': timestamp,
        'x-erxes-signature': signature,
    })
    # Do not forward signing headers to a redirect destination.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    with urllib.request.build_opener(NoRedirect).open(request, timeout=60) as response:
        if not 200 <= response.status < 300:
            raise RuntimeError('CRM did not accept the message')


def sync_once(config):
    state_path = Path(config['MAILCOW_STATE_FILE'])
    identity = [config['MAILCOW_IMAP_HOST'], config['MAILCOW_IMAP_USER'],
                config['MAILCOW_FOLDER'], config['CRM_MAIL_ADDRESS']]
    with imaplib.IMAP4_SSL(config['MAILCOW_IMAP_HOST'],
                          int(config.get('MAILCOW_IMAP_PORT', '993')),
                          ssl_context=ssl.create_default_context()) as mailbox:
        mailbox.login(config['MAILCOW_IMAP_USER'], config['MAILCOW_IMAP_PASSWORD'])
        status, _ = mailbox.select(config['MAILCOW_FOLDER'], readonly=True)
        if status != 'OK':
            raise RuntimeError('Cannot open Mailcow folder')
        validity = mailbox.response('UIDVALIDITY')[1][0].decode()
        status, data = mailbox.uid('search', None, 'ALL')
        if status != 'OK':
            raise RuntimeError('Cannot list Mailcow messages')
        uids = sorted(int(uid) for uid in data[0].split())
        state = json.loads(state_path.read_text()) if state_path.exists() else None
        if state and (state['identity'] != identity or state['uidValidity'] != validity):
            raise RuntimeError('Mailbox identity/UIDVALIDITY changed; review checkpoint before restart')
        def checkpoint(uid):
            state_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = state_path.with_suffix('.tmp')
            temporary.write_text(json.dumps({'identity': identity,
                                            'uidValidity': validity, 'uid': uid}))
            temporary.replace(state_path)
        if state is None:
            # Establish a baseline: never import historical mail implicitly.
            checkpoint(max(uids, default=0))
            return
        for uid in uids:
            if uid <= state['uid']:
                continue
            status, chunks = mailbox.uid('fetch', str(uid), '(BODY.PEEK[])')
            if status != 'OK':
                raise RuntimeError('Cannot retrieve Mailcow message')
            raw = next((chunk[1] for chunk in chunks if isinstance(chunk, tuple)), None)
            if raw is None:
                raise RuntimeError('Mailcow returned no message body')
            deliver(config['CRM_MAIL_WEBHOOK_URL'], config['CRM_MAIL_SIGNING_KEY'],
                    payload_for(raw, config['CRM_MAIL_ADDRESS']))
            checkpoint(uid)


def main():
    config = dict(os.environ)
    config.setdefault('MAILCOW_FOLDER', 'INBOX')
    config.setdefault('MAILCOW_STATE_FILE', './mailcow-checkpoint.json')
    for name in ('MAILCOW_IMAP_HOST', 'MAILCOW_IMAP_USER', 'MAILCOW_IMAP_PASSWORD',
                 'CRM_MAIL_WEBHOOK_URL', 'CRM_MAIL_SIGNING_KEY', 'CRM_MAIL_ADDRESS'):
        if not config.get(name):
            raise SystemExit('Missing configuration: ' + name)
    while True:
        try:
            sync_once(config)
            print('Mailcow sync complete', flush=True)
        except Exception as error:
            # Do not log credentials, message bodies, addresses or server responses.
            print('Mailcow sync failed (' + type(error).__name__ + '); retrying', flush=True)
        time.sleep(max(10, int(config.get('MAILCOW_POLL_SECONDS', '30'))))


if __name__ == '__main__':
    main()
