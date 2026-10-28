import { Readable } from 'stream';
import { readFileStreamFromStorage } from 'erxes-api-shared/utils';
import { readAiContextFile } from '../readContextFile';
import { AI_AGENT_LIMITS } from '../constants';

jest.mock('erxes-api-shared/utils', () => ({
  readFileStreamFromStorage: jest.fn(),
}), { virtual: true });

const read = jest.mocked(readFileStreamFromStorage);
const params = { subdomain: 'test', key: 'memory.md' };

it('reads multibyte Markdown and forwards the tenant and storage key', async () => {
  const content = Buffer.from('# RACO\nবাংলা');
  read.mockResolvedValueOnce(Readable.from([content.subarray(0, 9), content.subarray(9)]));
  expect(await readAiContextFile(params)).toEqual(content);
  expect(read).toHaveBeenCalledWith(params);
});

it('stops and closes the stream when the actual bytes exceed the limit', async () => {
  const stream = Readable.from([Buffer.alloc(AI_AGENT_LIMITS.maxSingleFileBytes + 1)]);
  read.mockResolvedValueOnce(stream);
  await expect(readAiContextFile(params)).rejects.toThrow('maximum file size');
  expect(stream.destroyed).toBe(true);
});

it('propagates a storage failure instead of indexing empty content', async () => {
  read.mockRejectedValueOnce(new Error('Local file not found'));
  await expect(readAiContextFile(params)).rejects.toThrow('Local file not found');
});
