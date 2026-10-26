const assert = require('node:assert/strict');
const crypto = require('node:crypto');

module.exports = async ({ root, tenants, password }) => {
  const { startCheckout, settleSslPayment } = require(root + '/backend/core-api/dist/src/modules/raco-saas/billing');
  const { getSaasStores } = require(root + '/backend/core-api/dist/src/modules/raco-saas/store');
  const { organizations, payments } = await getSaasStores();
  Object.assign(process.env, { RACO_SSL_ENABLED: 'true', RACO_SSL_MODE: 'live', RACO_SSL_ALLOW_LIVE: 'true',
    RACO_SSL_STORE_ID: 'smoke-store', RACO_SSL_STORE_PASSWORD: 'smoke-only-password',
    RACO_SAAS_PLANS: JSON.stringify([{ id: 'standard', name: 'Smoke only', description: 'Test fixture',
      monthlyPrice: 1000, yearlyPrice: 10000, currency: 'BDT', seats: 5, features: [] }]) });
  const [a, b] = tenants;
  const app = require('express')();
  app.use(require('express').urlencoded({ extended: false }));
  app.use('/saas', require(root + '/backend/core-api/dist/src/modules/raco-saas/routes').racoSaasRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = 'http://127.0.0.1:' + server.address().port;
    assert.equal((await fetch(url + '/saas/sslcommerz/return/success?status=VALID', { redirect: 'manual' })).status, 303);
    assert.equal((await organizations.findById(a.organization._id)).racoStatus, 'trialing');
    assert.equal((await fetch(url + '/saas/sslcommerz/ipn', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'status=VALID&tran_id=forged' })).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
  const args = tenant => ({ workspace: tenant.workspace, email: tenant.email, password, planId: 'standard',
    interval: 'monthly', requestId: crypto.randomUUID(), phone: '01700000000', address: 'Test address', city: 'Dhaka', postcode: '1000', country: 'Bangladesh', amount: 1 });
  let initiated = 0;
  const initiate = async parameters => {
    initiated++;
    assert.ok(['1000.00', '10000.00'].includes(parameters.total_amount));
    assert.equal(parameters.currency, 'BDT');
    return { status: 'SUCCESS', sessionkey: 'smoke-session', GatewayPageURL: 'https://securepay.sslcommerz.com/test-only' };
  };
  const notification = async id => {
    const payment = await payments.findById(id);
    const values = { tran_id: id, val_id: 'val_' + id, status: 'VALID', amount: (payment.amountPoisha / 100).toFixed(2), currency: 'BDT', store_id: 'smoke-store' };
    const md5 = value => crypto.createHash('md5').update(value).digest('hex');
    const signed = { ...values, store_passwd: md5('smoke-only-password') };
    return { ...values, verify_key: Object.keys(values).join(','), verify_sign: md5(Object.keys(signed).sort().map(key => key + '=' + signed[key]).join('&')) };
  };
  const validation = note => async () => ({ ...note, risk_level: '0', bank_tran_id: 'bank_' + note.tran_id });
  const firstArgs = args(a);
  const first = await startCheckout(firstArgs, initiate);
  assert.equal((await startCheckout(firstArgs, initiate)).transactionId, first.transactionId);
  assert.equal(initiated, 1);
  await assert.rejects(startCheckout({ ...firstArgs, interval: 'yearly' }, initiate), /reused/);
  await assert.rejects(startCheckout({ ...args(b), email: a.email }, initiate));
  const note = await notification(first.transactionId);
  let validationCalled = false;
  await assert.rejects(settleSslPayment({ ...note, verify_sign: '0'.repeat(32) }, async () => { validationCalled = true; }), /signature/);
  assert.equal(validationCalled, false);
  for (const patch of [{ amount: '1.00' }, { currency: 'USD' }, { tran_id: 'another-order' }]) {
    await assert.rejects(settleSslPayment(note, async () => ({ ...await validation(note)(), ...patch })), /match/);
  }
  await Promise.all([settleSslPayment(note, validation(note)), settleSslPayment(note, validation(note))]);
  let paid = await organizations.findById(a.organization._id);
  assert.equal(paid.racoStatus, 'active');
  assert.equal(paid.racoAppliedPayments.filter(id => id === first.transactionId).length, 1);
  const initialEnd = paid.racoPaidUntil.getTime();
  assert.ok(initialEnd > Date.now() + 27 * 86400000 && initialEnd < Date.now() + 32 * 86400000);
  await settleSslPayment(note, validation(note));
  assert.equal((await organizations.findById(a.organization._id)).racoPaidUntil.getTime(), initialEnd);
  const annual = await startCheckout({ ...args(a), interval: 'yearly' }, initiate);
  const annualNote = await notification(annual.transactionId);
  await settleSslPayment(annualNote, validation(annualNote));
  paid = await organizations.findById(a.organization._id);
  assert.equal(paid.racoPaidUntil.getUTCFullYear(), new Date(initialEnd).getUTCFullYear() + 1);
  const endAfterAnnual = paid.racoPaidUntil.getTime();
  const risk = await startCheckout(args(a), initiate);
  const riskNote = await notification(risk.transactionId);
  assert.equal((await settleSslPayment(riskNote, async () => ({ ...await validation(riskNote)(), risk_level: '1' }))).status, 'review');
  assert.equal((await organizations.findById(a.organization._id)).racoPaidUntil.getTime(), endAfterAnnual);
  const futureYear = new Date().getUTCFullYear() + 2;
  await organizations.updateOne({ _id: a.organization._id }, { $set: { racoPaidUntil: new Date(Date.UTC(futureYear, 0, 31, 12)) } });
  const monthEnd = await startCheckout(args(a), initiate);
  const monthEndNote = await notification(monthEnd.transactionId);
  await settleSslPayment(monthEndNote, validation(monthEndNote));
  const clamped = (await organizations.findById(a.organization._id)).racoPaidUntil;
  assert.equal(clamped.getUTCMonth(), 1);
  assert.equal(clamped.getUTCDate(), new Date(Date.UTC(futureYear, 2, 0)).getUTCDate());
  process.env.RACO_SSL_MODE = 'sandbox';
  const sandbox = await startCheckout(args(b), initiate);
  const sandboxNote = await notification(sandbox.transactionId);
  assert.equal((await settleSslPayment(sandboxNote, validation(sandboxNote))).status, 'sandbox_paid');
  assert.equal((await organizations.findById(b.organization._id)).racoStatus, 'trialing');
  await organizations.updateOne({ _id: b.organization._id }, { $set: { racoStatus: 'suspended' } });
  await assert.rejects(startCheckout(args(b), initiate), /operator review/);
  console.log('PASS: mocked SSLCommerz checkout, server-priced BDT terms, owner scope, signed callbacks, canonical validation, exact amounts, concurrent replay protection, monthly/yearly renewals, risk holds and sandbox isolation. No provider requests or charges.');
};
