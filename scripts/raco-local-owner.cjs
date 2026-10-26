const { randomBytes } = require('node:crypto');
const { existsSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const credentialsPath = path.join(root, '.raco-local-credentials.json');
const api = 'http://localhost:4000';

const main = async () => {
  const setup = await fetch(`${api}/initial-setup`, {
    signal: AbortSignal.timeout(15000),
  }).then((res) => res.json());
  if (setup.hasOwner) {
    process.stdout.write(
      'An owner already exists; no accounts were changed.\n',
    );
    return;
  }
  if (existsSync(credentialsPath)) {
    throw new Error(
      'Local credentials already exist. Inspect setup before creating another owner.',
    );
  }
  const email = process.env.RACO_OWNER_EMAIL;
  if (!email)
    throw new Error('Set RACO_OWNER_EMAIL before creating the owner.');
  const password = randomBytes(24).toString('base64url') + 'aA1!';
  writeFileSync(credentialsPath, JSON.stringify({ email, password }, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  const response = await fetch(`${api}/graphql`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query:
        'mutation racoLocalOwnerCreate($email: String!, $password: String!, $firstName: String!) { usersCreateOwner(email: $email, password: $password, firstName: $firstName, subscribeEmail: false) }',
      variables: {
        email,
        password,
        firstName: process.env.RACO_OWNER_NAME || 'Razin',
      },
    }),
  }).then((res) => res.json());
  if (response.errors || response.data?.usersCreateOwner !== 'success') {
    throw new Error(
      'Owner creation failed. The generated credential remains in the ignored local file; inspect backend diagnostics.',
    );
  }
  process.stdout.write(
    'Local owner created. The generated password is in .raco-local-credentials.json.\n',
  );
};
main().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
