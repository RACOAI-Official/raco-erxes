import { createHmac } from 'node:crypto';
import {
  openwaHtml,
  openwaId,
  openwaMessage,
  openwaPhone,
  verifyOpenwaSignature,
} from '../contract';

const message = openwaMessage.parse({
  id: 'm1',
  chatId: '8801712345678@c.us',
  from: '8801712345678@c.us',
  body: 'Hello',
  type: 'text',
  timestamp: 1700000000,
  fromMe: false,
  isGroup: false,
});

test('verifies the exact bytes and rejects tampering, missing and malformed signatures', () => {
  const secret = 'a-secret-of-at-least-16-characters';
  const raw = Buffer.from('{"body":"Hello"}');
  const signature = `sha256=${createHmac('sha256', secret)
    .update(raw)
    .digest('hex')}`;
  expect(verifyOpenwaSignature(raw, signature, secret)).toBe(true);
  expect(
    verifyOpenwaSignature(Buffer.from('{"body":"Changed"}'), signature, secret),
  ).toBe(false);
  expect(verifyOpenwaSignature(raw, undefined, secret)).toBe(false);
  expect(verifyOpenwaSignature(raw, 'sha256=bad', secret)).toBe(false);
  expect(verifyOpenwaSignature(raw, signature, 'short')).toBe(false);
});

test('uses canonical telephone numbers without interpreting LIDs as telephone numbers', () => {
  expect(openwaPhone(message)).toBe('+8801712345678');
  expect(
    openwaPhone({ ...message, from: '123456789012345@lid' }),
  ).toBeUndefined();
  expect(
    openwaPhone({
      ...message,
      from: '123456789012345@lid',
      senderPhone: '8801712345678',
    }),
  ).toBe('+8801712345678');
});

test('scopes deterministic IDs to the integration and escapes WhatsApp HTML', () => {
  expect(openwaId('message', 'a', '1')).toBe(openwaId('message', 'a', '1'));
  expect(openwaId('message', 'a', '1')).not.toBe(openwaId('message', 'b', '1'));
  expect(openwaId('chat', 'ab', 'c')).not.toBe(openwaId('chat', 'a', 'bc'));
  expect(openwaHtml('<img src=x onerror="evil">\n&')).toBe(
    '&lt;img src=x onerror=&quot;evil&quot;&gt;<br>&amp;',
  );
});

test('rejects incomplete provider messages rather than guessing routing or sender fields', () => {
  expect(
    openwaMessage.safeParse({ ...message, fromMe: undefined }).success,
  ).toBe(false);
  expect(openwaMessage.safeParse({ ...message, timestamp: -1 }).success).toBe(
    false,
  );
});
