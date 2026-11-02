/** Browsers on Windows commonly give Markdown files a generic binary MIME. */
export const contextTextMime = (
  name: string,
  mime: string,
  bytes: Uint8Array,
): string | undefined => {
  if (mime && mime !== 'application/octet-stream') return undefined;
  const extension = name.toLowerCase().match(/\.(md|markdown|txt)$/)?.[1];
  if (!extension) return undefined;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // Reject binary/control payloads rather than trusting a renamed extension.
    for (const character of text) {
      const code = character.codePointAt(0)!;
      if ((code < 32 && ![9, 10, 13].includes(code)) || code === 127)
        return undefined;
    }
    return extension === 'txt' ? 'text/plain' : 'text/markdown';
  } catch {
    return undefined;
  }
};
