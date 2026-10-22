import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { verifyRouterChecksum } from '../windows-router';

test('verifies the named archive with CRLF checksum files', () => {
  const archive = Buffer.from('router release');
  const digest = createHash('sha256').update(archive).digest('hex');
  verifyRouterChecksum(
    archive,
    `${digest}  router.tar.gz\r\n`,
    'router.tar.gz',
  );
});

test('rejects a corrupt archive or a missing checksum entry', () => {
  const archive = Buffer.from('corrupt');
  assert.throws(() =>
    verifyRouterChecksum(archive, '0000  router.tar.gz', 'router.tar.gz'),
  );
  assert.throws(() => verifyRouterChecksum(archive, '', 'router.tar.gz'));
});
