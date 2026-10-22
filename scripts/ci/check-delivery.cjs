const assert = require('node:assert/strict');
const fs = require('node:fs');
const YAML = require('yaml');

const readYaml = (file) =>
  YAML.parse(fs.readFileSync(file, 'utf8'), { merge: true });
for (const file of fs.readdirSync('.github/workflows')) {
  const workflow = readYaml(`.github/workflows/${file}`);
  assert.ok(workflow.on && workflow.jobs, `Invalid workflow: ${file}`);
  if (file.startsWith('raco-') || file === 'codeql.yml') continue;
  for (const job of Object.values(workflow.jobs)) {
    assert.ok(
      job.if?.includes("github.repository_owner == 'erxes'"),
      `Upstream job is not isolated: ${file}`,
    );
  }
}
const ci = readYaml('.github/workflows/raco-ci.yml');
assert.equal(ci.permissions.contents, 'read');
assert.equal(ci.jobs.images.needs, 'verify');
assert.ok(
  ci.jobs.images.steps.some(
    (step) => step.run === 'bash scripts/ci/smoke-containers.sh',
  ),
);
const deploy = readYaml('.github/workflows/raco-deploy.yml');
assert.deepEqual(Object.keys(deploy.on), ['workflow_dispatch']);
assert.equal(deploy.jobs.deploy.environment, 'production');
assert.equal(deploy.jobs.deploy.if, "vars.RACO_DEPLOY_ENABLED == 'true'");
const compose = readYaml('deploy/raco/compose.yaml');
for (const [name, service] of Object.entries(compose.services)) {
  assert.ok(service.healthcheck, `Missing readiness check: ${name}`);
  if (name === 'web') {
    assert.ok(service.ports.every((port) => port.startsWith('127.0.0.1:')));
  } else {
    assert.ok(!service.ports, `Backend port exposed: ${name}`);
    assert.equal(service.environment.NODE_ENV, 'production');
    assert.equal(service.environment.VERSION, 'os');
  }
}
const dockerignore = fs.readFileSync('.dockerignore', 'utf8');
for (const pattern of [
  '.git',
  '**/node_modules',
  '**/.env',
  '**/.env.*',
  '**/server.env',
  '.raco-*',
]) {
  assert.ok(
    dockerignore.split(/\r?\n/).includes(pattern),
    `Private build input not excluded: ${pattern}`,
  );
}
const deployScript = fs.readFileSync('deploy/raco/deploy.sh', 'utf8');
assert.ok(!/compose\s+down|--volumes|volume\s+rm/.test(deployScript));
assert.ok(deployScript.includes('--wait --wait-timeout'));
process.stdout.write(
  'PASS: workflows parse; upstream publishing is isolated; deployment is manual and gated; ports, readiness, and private build inputs are validated.\n',
);
