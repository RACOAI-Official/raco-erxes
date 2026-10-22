const { readFileSync } = require('node:fs');
const path = require('node:path');

const api = 'http://localhost:4000';
const main = async () => {
  const credentials = JSON.parse(
    readFileSync(
      path.join(__dirname, '../.raco-local-credentials.json'),
      'utf8',
    ),
  );
  const login = await fetch(`${api}/graphql`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3001',
    },
    body: JSON.stringify({
      query:
        'mutation racoSmokeLogin($email: String!, $password: String!) { login(email: $email, password: $password) }',
      variables: credentials,
    }),
  });
  const result = await login.json();
  if (result.errors || result.data?.login !== 'loggedIn')
    throw new Error('CRM login failed');
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  if (!cookie.includes('auth-token='))
    throw new Error('Login did not set the authentication cookie');
  const query = await fetch(`${api}/graphql`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      query:
        'query racoSmokeCrm { currentUser { _id isOwner } customers { totalCount } companies { totalCount } getTeams { _id } }',
    }),
  }).then((res) => res.json());
  if (query.errors || !query.data?.currentUser?.isOwner)
    throw new Error('Authenticated CRM queries failed');
  process.stdout.write(
    'PASS: owner login, auth cookie, current user, contacts, companies, and operation teams.\n',
  );
};
main().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
