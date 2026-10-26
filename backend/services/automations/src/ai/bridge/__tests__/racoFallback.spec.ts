import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { invokeWithRacoFallback } from '../racoFallback';

test('does not contact Gemini when Raco succeeds', async () => {
  let calls = 0;
  const result = await invokeWithRacoFallback(
    async () => 'Raco answer',
    async () => {
      calls += 1;
      return 'Gemini answer';
    },
  );
  assert.equal(result, 'Raco answer');
  assert.equal(calls, 0);
});

test('uses the fallback once after a primary failure', async () => {
  let calls = 0;
  assert.equal(
    await invokeWithRacoFallback(
      async () => {
        throw new Error('timeout');
      },
      async () => {
        calls += 1;
        return 'Gemini answer';
      },
    ),
    'Gemini answer',
  );
  assert.equal(calls, 1);
});

test('does not hide a primary error when fallback is disabled', async () => {
  const failure = new Error('unavailable');
  await assert.rejects(
    invokeWithRacoFallback(async () => {
      throw failure;
    }),
    failure,
  );
});

test('does not expose upstream bodies when both providers fail', async () => {
  await assert.rejects(
    invokeWithRacoFallback(
      async () => {
        throw new Error('primary secret');
      },
      async () => {
        throw new Error('fallback secret');
      },
    ),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('Gemini fallback failed') &&
      !error.message.includes('secret'),
  );
});
