import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { redis } from 'erxes-api-shared/utils';
import { getSaasConfig, signupSchema, verifySchema } from './config';
import { authenticateWorkspaceOwner } from './service';
import { getSaasStores } from './store';
import { amountToPoisha, createSslSession, sslSettings, validateSslPayment, verifySslSignature } from './sslcommerz';

export const checkoutSchema = signupSchema.pick({ workspace: true, email: true }).extend({
  password: verifySchema.shape.password, planId: z.string().min(1),
  interval: z.enum(['monthly', 'yearly']), requestId: z.string().min(16).max(100),
  phone: z.string().trim().regex(/^\+?[0-9 -]{7,20}$/),
  address: z.string().trim().min(3).max(100), city: z.string().trim().min(2).max(50),
  postcode: z.string().trim().min(2).max(20), country: z.string().trim().min(2).max(56).regex(/^[A-Za-z .'-]+$/),
});
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const startCheckout = async (input: unknown, initiate = createSslSession) => {
  const config = getSaasConfig();
  if (!config.checkoutEnabled) throw new Error('Payments are not connected or prices are not configured');
  const args = checkoutSchema.parse(input);
  const { organization, owner } = await authenticateWorkspaceOwner(args);
  if (!['trialing', 'active'].includes(organization.racoStatus || '')) throw new Error('Workspace requires operator review before payment');
  if (organization.racoStatus === 'active' && organization.racoPaidUntil && organization.racoPaidUntil.getTime() > Date.now() && organization.racoPlanId !== args.planId) {
    throw new Error('Renew the current plan; contact the operator for a plan change');
  }
  const plan = config.plans.find(item => item.id === args.planId);
  const price = args.interval === 'monthly' ? plan?.monthlyPrice : plan?.yearlyPrice;
  if (!plan || !price) throw new Error('Selected billing option has no configured price');
  const amountPoisha = amountToPoisha(price);
  const { payments } = await getSaasStores();
  const requestKey = digest([String(organization._id), args.requestId]);
  const fingerprint = digest([args.planId, args.interval, amountPoisha, args.phone, args.address, args.city, args.postcode, args.country]);
  const previous = await payments.findOne({ requestKey });
  if (previous) {
    if (previous.fingerprint !== fingerprint) throw new Error('Checkout request ID was reused with different details');
    if (previous.gatewayUrl && previous.status === 'pending') return { gatewayUrl: previous.gatewayUrl, transactionId: previous._id, mode: previous.mode };
    throw new Error('This checkout is already processing or closed. Check workspace status before starting a new payment.');
  }
  const transactionId = 'rx_' + randomBytes(12).toString('hex');
  await payments.create({ _id: transactionId, organizationId: organization._id, requestKey, fingerprint,
    planId: plan.id, seats: plan.seats, interval: args.interval, amountPoisha, currency: 'BDT', mode: sslSettings().mode, status: 'creating' });
  try {
    const callback = `https://${config.domain}/gateway/saas/sslcommerz`;
    const session = await initiate({ tran_id: transactionId, total_amount: (amountPoisha / 100).toFixed(2), currency: 'BDT',
      success_url: `${callback}/return/success`, fail_url: `${callback}/return/fail`, cancel_url: `${callback}/return/cancel`,
      ipn_url: `${callback}/ipn`, cus_name: owner.details?.fullName || organization.name,
      cus_email: args.email, cus_phone: args.phone, cus_add1: args.address, cus_city: args.city,
      cus_postcode: args.postcode, cus_country: args.country, shipping_method: 'NO',
      product_name: `${plan.name} — ${args.interval}`, product_category: 'Software service', product_profile: 'non-physical-goods',
    });
    await payments.updateOne({ _id: transactionId }, { $set: { status: 'pending', gatewayUrl: session.GatewayPageURL, sessionKey: session.sessionkey } });
    return { gatewayUrl: session.GatewayPageURL, transactionId, mode: sslSettings().mode };
  } catch {
    await payments.updateOne({ _id: transactionId }, { $set: { status: 'failed' } });
    throw new Error('SSLCommerz checkout could not be initialized. No access has been activated.');
  }
};

export const settleSslPayment = async (input: unknown, validate = validateSslPayment) => {
  const notification = z.record(z.string().max(4096)).parse(input);
  const settings = sslSettings();
  if (!settings.enabled) throw new Error('Payments are not connected');
  if (notification.store_id !== settings.storeId || !verifySslSignature(notification, settings.password)) throw new Error('Invalid payment signature');
  if (!/^rx_[a-f0-9]{24}$/.test(notification.tran_id || '')) throw new Error('Invalid payment notification');
  const { payments, organizations } = await getSaasStores();
  const payment = await payments.findById(notification.tran_id);
  if (!payment) return { status: 'ignored' };
  if (payment.mode !== settings.mode) throw new Error('Payment environment mismatch');
  if (['paid', 'sandbox_paid'].includes(payment.status)) {
    await redis.del('core_organizations');
    return { status: payment.status };
  }
  if (!['VALID', 'VALIDATED'].includes(notification.status)) {
    if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(notification.status)) {
      await payments.updateOne({ _id: payment._id, status: { $in: ['creating', 'pending', 'failed'] } }, { $set: { status: 'failed' } });
    }
    return { status: 'ignored' };
  }
  if (!notification.val_id || notification.val_id.length > 100) throw new Error('Invalid payment validation ID');
  const receipt = await validate(notification.val_id);
  if (!['VALID', 'VALIDATED'].includes(receipt.status)) return { status: 'unconfirmed' };
  if (receipt.tran_id !== payment._id || receipt.val_id !== notification.val_id ||
      (receipt.store_id && receipt.store_id !== settings.storeId) || receipt.currency !== 'BDT' || amountToPoisha(receipt.amount) !== payment.amountPoisha) {
    throw new Error('Validated transaction does not match the saved order');
  }
  const organization = await organizations.findById(payment.organizationId);
  if (!organization?.racoManaged) throw new Error('Payment workspace no longer exists');
  const conflict = organization.racoStatus === 'suspended' ||
    (organization.racoStatus === 'active' && organization.racoPaidUntil && organization.racoPaidUntil.getTime() > Date.now() && organization.racoPlanId !== payment.planId);
  if (String(receipt.risk_level) !== '0' || conflict) {
    await payments.updateOne({ _id: payment._id }, { $set: { status: 'review', reviewReason: conflict ? 'workspace_state' : 'provider_risk', validationId: receipt.val_id } });
    return { status: 'review' };
  }
  await payments.updateOne({ _id: payment._id }, { $set: { status: 'verified', validationId: receipt.val_id, bankTransactionId: receipt.bank_tran_id } });
  if (payment.mode === 'sandbox') {
    await payments.updateOne({ _id: payment._id }, { $set: { status: 'sandbox_paid', paidAt: new Date() } });
    return { status: 'sandbox_paid' }; // Sandbox receipts never grant real access.
  }
  // Mongo serializes this conditional update. The receipt ID is recorded in the
  // same atomic write as the extension, so callback retries cannot add time twice.
  await organizations.updateOne({ _id: organization._id, racoManaged: true,
    racoStatus: { $in: ['trialing', 'active'] }, racoAppliedPayments: { $ne: payment._id },
    $or: [{ racoPlanId: payment.planId }, { racoStatus: 'trialing' }, { racoPaidUntil: { $lte: new Date() } }],
  }, [{ $set: {
    racoPaidUntil: { $dateAdd: { startDate: { $max: ['$$NOW', { $ifNull: ['$racoPaidUntil', new Date(0)] }, { $ifNull: ['$racoTrialEndsAt', new Date(0)] }] },
      unit: payment.interval === 'yearly' ? 'year' : 'month', amount: 1, timezone: 'UTC' } },
    racoStatus: 'active', racoPlanId: payment.planId, teamMembersLimit: payment.seats,
    racoAppliedPayments: { $concatArrays: [{ $ifNull: ['$racoAppliedPayments', []] }, [payment._id]] },
  } }]);
  const applied = await organizations.exists({ _id: organization._id, racoAppliedPayments: payment._id });
  if (!applied) {
    await payments.updateOne({ _id: payment._id }, { $set: { status: 'review', reviewReason: 'workspace_changed' } });
    return { status: 'review' };
  }
  await payments.updateOne({ _id: payment._id }, { $set: { status: 'paid', paidAt: new Date() } });
  await redis.del('core_organizations');
  return { status: 'paid' };
};
