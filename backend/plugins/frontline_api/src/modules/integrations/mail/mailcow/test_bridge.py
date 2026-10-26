import unittest
import tempfile
import json
from pathlib import Path
from unittest.mock import MagicMock
from unittest.mock import patch
import bridge


class BridgeTests(unittest.TestCase):
    def test_failed_delivery_preserves_checkpoint_and_read_only_access(self):
        with tempfile.TemporaryDirectory() as directory:
            state_path = Path(directory) / 'state.json'
            config = dict(MAILCOW_STATE_FILE=str(state_path), MAILCOW_IMAP_HOST='mail.example.com',
                          MAILCOW_IMAP_USER='user', MAILCOW_FOLDER='INBOX',
                          MAILCOW_IMAP_PASSWORD='private', CRM_MAIL_ADDRESS='inbox@example.com',
                          CRM_MAIL_WEBHOOK_URL='https://crm.example.com/mail/receive',
                          CRM_MAIL_SIGNING_KEY='key')
            mailbox = MagicMock()
            mailbox.select.return_value = ('OK', [])
            mailbox.response.return_value = ('UIDVALIDITY', [b'1'])
            mailbox.uid.return_value = ('OK', [b'10'])
            with patch('imaplib.IMAP4_SSL') as connection:
                connection.return_value.__enter__.return_value = mailbox
                bridge.sync_once(config)
                self.assertEqual(json.loads(state_path.read_text())['uid'], 10)
                mailbox.select.assert_called_with('INBOX', readonly=True)
                mailbox.uid.side_effect = [('OK', [b'10 11']),
                                           ('OK', [(b'11', b'From: a@example.com\r\n\r\nHello')])]
                with patch.object(bridge, 'deliver', side_effect=RuntimeError('unavailable')):
                    with self.assertRaises(RuntimeError):
                        bridge.sync_once(config)
                self.assertEqual(json.loads(state_path.read_text())['uid'], 10)
                mailbox.uid.assert_called_with('fetch', '11', '(BODY.PEEK[])')

    def test_plain_text_is_escaped_and_identity_stable(self):
        raw = b'From: Example <sender@example.com>\r\nSubject: Hello\r\n\r\n<script>test</script>'
        first = bridge.payload_for(raw, 'inbox@example.com')
        self.assertEqual(first['from']['address'], 'sender@example.com')
        self.assertIn('&lt;script&gt;', first['html'])
        self.assertEqual(first['messageId'], bridge.payload_for(raw, 'inbox@example.com')['messageId'])

    def test_thread_headers_and_attachment(self):
        raw = (b'From: sender@example.com\r\nMessage-ID: <new>\r\nIn-Reply-To: <old>\r\n'
               b'References: <first> <old>\r\nMIME-Version: 1.0\r\n'
               b'Content-Type: multipart/mixed; boundary=x\r\n\r\n'
               b'--x\r\nContent-Type: text/plain\r\n\r\nHello\r\n'
               b'--x\r\nContent-Type: application/pdf\r\n'
               b'Content-Disposition: attachment; filename="test.pdf"\r\n'
               b'Content-Transfer-Encoding: base64\r\n\r\nYWJj\r\n--x--\r\n')
        result = bridge.payload_for(raw, 'inbox@example.com')
        self.assertEqual(result['inReplyTo'], '<old>')
        self.assertEqual(result['references'], ['<first>', '<old>'])
        self.assertEqual(result['attachments'][0]['content'], 'YWJj')

    def test_remote_plain_http_rejected_before_network(self):
        with patch('urllib.request.build_opener') as opener:
            with self.assertRaises(ValueError):
                bridge.deliver('http://crm.example.com/mail/receive', 'secret', {})
            opener.assert_not_called()


if __name__ == '__main__':
    unittest.main()
