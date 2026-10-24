// Local-only smoke test. Never pass production MongoDB or Redis endpoints.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = require('node:path').resolve(__dirname, '..');
const mongo = process.env.RACO_SAAS_TEST_MONGO_URL;
const redisPort = process.env.RACO_SAAS_TEST_REDIS_PORT;
if (!mongo || !/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(mongo) || !redisPort || redisPort === '6379') {
  throw new Error('Use an explicit loopback RACO_SAAS_TEST_MONGO_URL and a dedicated non-default RACO_SAAS_TEST_REDIS_PORT');
}
const runId = crypto.randomBytes(5).toString('hex');
const base = 'raco_saas_smoke_' + runId;
const dbUrl = name => { const url = new URL(mongo); url.pathname = '/' + name; return url.toString(); };
Object.assign(process.env, { VERSION: 'saas', RACO_SAAS_ENABLED: 'true', NODE_ENV: 'test',
  MONGO_URL: dbUrl(base), CORE_MONGO_URL: dbUrl(base + '_control'), DB_NAME: 'raco_saas_smoke_<organizationId>',
  REDIS_HOST: '127.0.0.1', REDIS_PORT: redisPort, REDIS_PASSWORD: '', JWT_TOKEN_SECRET: crypto.randomBytes(32).toString('hex') });
process.env.RACO_SSL_ENABLED = 'false';
const mongoose = require('mongoose');
const databases = [base, base + '_control'];
(async () => {
  const { requestWorkspace, verifyWorkspace, workspaceAccount } = require(root + '/backend/core-api/dist/src/modules/raco-saas/service');
  const { getSaasStores } = require(root + '/backend/core-api/dist/src/modules/raco-saas/store');
  const { generateModels } = require(root + '/backend/core-api/dist/src/connectionResolvers');
  const { racoSaasRouter } = require(root + '/backend/core-api/dist/src/modules/raco-saas/routes');
  const password = 'TestOwner123!' + crypto.randomBytes(10).toString('hex');
  const tenants = [];
  for (const prefix of ['alpha', 'beta']) {
    const workspace = prefix + runId;
    const email = prefix + '@example.invalid';
    let token;
    await requestWorkspace({ company: prefix, workspace, email, planId: 'standard' }, async (_email, value) => { token = value; });
    await assert.rejects(generateModels(workspace));
    const result = await verifyWorkspace({ token, firstName: prefix, password });
    assert.equal(result.checkoutEnabled, false);
    await assert.rejects(verifyWorkspace({ token, firstName: prefix, password }));
    const { organizations } = await getSaasStores();
    const organization = await organizations.findOne({ subdomain: workspace });
    const models = await generateModels(workspace);
    const db = 'raco_saas_smoke_' + organization._id;
    databases.push(db, db + '_logs');
    tenants.push({ workspace, email, models, organization });
  }
  const [a, b] = tenants;
  const marker = 'smoke-' + runId;
  await a.models.Customers.create({ _id: marker, firstName: 'Private tenant A record' });
  assert.equal(await b.models.Customers.findById(marker), null);
  const aOwner = await a.models.Users.findOne({ email: a.email });
  assert.ok(aOwner && await a.models.Users.comparePassword(password, aOwner.password));
  assert.equal(await b.models.Users.findById(aOwner._id), null);
  const { organizations, signups } = await getSaasStores();
  const reservation = await signups.findOne({ workspace: a.workspace }).lean();
  assert.ok(!('password' in reservation) && !('token' in reservation));
  await organizations.updateOne({ _id: a.organization._id }, { $set: { racoTrialEndsAt: new Date(0) } });
  await assert.rejects(generateModels(a.workspace), /WORKSPACE_ACCESS_PAUSED/);
  const account = await workspaceAccount({ workspace: a.workspace, email: a.email, password });
  assert.equal(account.status, 'trial_expired');
  await assert.rejects(workspaceAccount({ workspace: b.workspace, email: a.email, password }));
  const app = require('express')(); app.use(require('express').json()); app.use('/saas', racoSaasRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port;
    process.env.RACO_SAAS_CORE_URL = url;
    const gateway = require('express')();
    const { racoSaasProxy } = require(root + '/backend/gateway/dist/src/middlewares/raco-saas');
    gateway.use('/saas', racoSaasProxy);
    gateway.use((_req, res) => res.sendStatus(401));
    const proxy = gateway.listen(0, '127.0.0.1');
    await new Promise(resolve => proxy.once('listening', resolve));
    try {
      const publicUrl = 'http://127.0.0.1:' + proxy.address().port;
      assert.equal((await fetch(publicUrl + '/saas/config')).status, 200);
      assert.equal((await fetch(publicUrl + '/graphql')).status, 401);
    } finally { await new Promise(resolve => proxy.close(resolve)); }
    const config = await fetch(url + '/saas/config').then(response => response.json());
    assert.equal(config.checkoutEnabled, false); assert.equal(config.trialDays, 14);
    assert.equal((await fetch(url + '/saas/checkout', { method: 'POST' })).status, 409);
    process.env.RACO_SAAS_ENABLED = 'false';
    assert.equal((await fetch(url + '/saas/config')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
  process.env.RACO_SAAS_ENABLED = 'true';
  await require('./raco-saas-payment-smoke.cjs')({ root, tenants, password });
  console.log('PASS: two verified workspaces, separate databases and owners, one-use tokens, no stored signup passwords, expired trial denial, owner status access, disconnected checkout and opt-in routes. No external email sent.');
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  const client = new (require('mongodb').MongoClient)(mongo);
  await client.connect();
  for (const name of databases) {
    if (!/^raco_saas_smoke_[a-f0-9]+(?:_control|_logs)?$/.test(name)) throw new Error('Unsafe smoke database cleanup target');
    await client.db(name).dropDatabase();
  }
  await client.close(); await mongoose.disconnect();
  process.exit(process.exitCode || 0);
});
