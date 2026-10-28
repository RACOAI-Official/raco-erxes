import { readFileStreamFromStorage } from 'erxes-api-shared/utils';
import { AI_AGENT_LIMITS } from './constants';

/** Use the shared streaming reader, which supports local and remote storage. */
export const readAiContextFile = async (params: {
  subdomain: string;
  key: string;
}): Promise<Buffer> => {
  const stream = await readFileStreamFromStorage(params);
  const chunks: Buffer[] = [];
  let bytes = 0;
  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > AI_AGENT_LIMITS.maxSingleFileBytes) {
        throw new Error('Context file exceeds the maximum file size');
      }
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  } finally {
    stream.destroy();
  }
};
