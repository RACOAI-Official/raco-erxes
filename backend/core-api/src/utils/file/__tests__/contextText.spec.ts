import { contextTextMime } from '../contextText';

test.each(['notes.md', 'notes.MARKDOWN', 'notes.txt'])(
  'accepts valid UTF-8 text with generic MIME: %s',
  (name) => expect(contextTextMime(name, 'application/octet-stream', Buffer.from('# Hello\nবাংলা'))).toBe(name.endsWith('.txt') ? 'text/plain' : 'text/markdown'),
);
test('rejects binary content, invalid UTF-8 and unrelated extensions', () => {
  expect(contextTextMime('notes.md', 'application/octet-stream', Buffer.from([0, 1, 2]))).toBeUndefined();
  expect(contextTextMime('notes.md', '', Buffer.from([0xc0, 0xaf]))).toBeUndefined();
  expect(contextTextMime('notes.exe', '', Buffer.from('text'))).toBeUndefined();
  expect(contextTextMime('notes.md.exe', '', Buffer.from('text'))).toBeUndefined();
  expect(contextTextMime('notes.md', 'application/pdf', Buffer.from('text'))).toBeUndefined();
});
