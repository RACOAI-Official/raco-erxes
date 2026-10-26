import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { createTransport } from 'nodemailer';
import { createScopedEventHandlers } from 'erxes-api-shared/core-modules';
import { redis } from 'erxes-api-shared/utils';
import { loadClasses } from '~/connectionResolvers';
import { getSaasConfig, signupSchema, verifySchema } from './config';
import { getSaasStores, RacoOrganization } from './store';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const dbName = (id: string) => {
  const pattern = process.env.DB_NAME || 'erxes_<organizationId>';
  if (!pattern.includes('<organizationId>')) throw new Error('SaaS DB_NAME must contain <organizationId>');
  const name = pattern.replace('<organizationId>', id);
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid SaaS database pattern');
  return name;
};
const tenantModels = async (organization: RacoOrganization) => {
  // Provisioning uses the core-owned model loader. Public access stays blocked
  // until the owner is created and the registry switches to trialing.
  await mongoose.connection.asPromise();
  return loadClasses(mongoose.connection.useDb(dbName(String(organization._id)), { useCache: true }),
    organization.subdomain, createScopedEventHandlers(organization.subdomain));
};

export const sendSignupVerification = async (email: string, token: string) => {
  const host = process.env.RACO_SAAS_SMTP_HOST;
  const user = process.env.RACO_SAAS_SMTP_USER;
  const pass = process.env.RACO_SAAS_SMTP_PASSWORD;
  const from = process.env.RACO_SAAS_SMTP_FROM;
  if (!host || !user || !pass || !from) throw new Error('Signup verification email is not configured');
  const port = Number(process.env.RACO_SAAS_SMTP_PORT || 587);
  if (![465, 587].includes(port)) throw new Error('Signup email requires SMTP TLS');
  const smtp = createTransport({ host, port, secure: port === 465, requireTLS: true,
    tls: { rejectUnauthorized: true }, auth: { user, pass },
    connectionTimeout: 15000, socketTimeout: 30000 });
  try {
    await smtp.sendMail({ from, to: email, subject: 'Verify your Raco XOS workspace',
      text: `Finish creating your workspace: https://${getSaasConfig().domain}/saas#verify=${token}\n\nThis link expires in 30 minutes. Ignore this email if you did not request a workspace.` });
  } finally { smtp.close(); }
};

export const requestWorkspace = async (input: unknown, deliver = sendSignupVerification) => {
  const args = signupSchema.parse(input);
  const config = getSaasConfig();
  if (!config.plans.some(plan => plan.id === args.planId)) throw new Error('Choose an available plan');
  const { organizations, signups } = await getSaasStores();
  if (await organizations.exists({ subdomain: args.workspace })) throw new Error('Workspace address is unavailable');
  const token = randomBytes(32).toString('hex');
  const pending = await signups.create({ ...args, tokenHash: hash(token), state: 'pending', expiresAt: new Date(Date.now() + 30 * 60000) });
  try { await deliver(args.email, token); }
  catch {
    await signups.deleteOne({ _id: pending._id, state: 'pending' });
    throw new Error('Verification email could not be delivered. Please try again later.');
  }
  return { message: 'Check your email for the verification link. Your workspace starts after verification.' };
};

export const verifyWorkspace = async (input: unknown) => {
  const args = verifySchema.parse(input);
  const { organizations, signups } = await getSaasStores();
  const pending = await signups.findOneAndUpdate({ tokenHash: hash(args.token), expiresAt: { $gt: new Date() },
    $or: [{ state: 'pending' }, { state: 'processing', leaseUntil: { $lt: new Date() } }] },
  { $set: { state: 'processing', leaseUntil: new Date(Date.now() + 5 * 60000) } }, { new: true });
  if (!pending) throw new Error('Verification link is invalid, expired or already being processed');
  try {
    const plan = getSaasConfig().plans.find(item => item.id === pending.planId);
    if (!plan) throw new Error('Selected plan is no longer available');
    let organization = await organizations.findOne({ racoSignupId: String(pending._id) });
    if (!organization) {
      if (await organizations.exists({ subdomain: pending.workspace })) throw new Error('Workspace address is unavailable');
      organization = await organizations.create({ name: pending.company, subdomain: pending.workspace,
        racoManaged: true, racoSignupId: String(pending._id), racoStatus: 'provisioning', racoPlanId: plan.id,
        teamMembersLimit: plan.seats, plan: 'free', createdAt: new Date(),
        charge: { 'frontline:inbox': { free: 1 }, 'operation:task': { free: 1 } } });
    }
    const models = await tenantModels(organization);
    const existingOwner = await models.Users.findOne({ isOwner: true });
    const owner = existingOwner || await models.Users.createUser({ email: pending.email, password: args.password, isOwner: true,
      details: { firstName: args.firstName, fullName: args.firstName } });
    if (owner.email !== pending.email) throw new Error('Workspace provisioning requires operator review');
    const trialEndsAt = organization.racoTrialEndsAt || new Date(Date.now() + 14 * 86400000);
    await organizations.updateOne({ _id: organization._id }, { $set: {
      ownerId: owner._id, racoStatus: 'trialing', racoTrialEndsAt: trialEndsAt,
    } });
    await signups.updateOne({ _id: pending._id }, { $set: { state: 'complete', organizationId: organization._id } });
    await redis.del('core_organizations');
    return { workspaceUrl: `https://${pending.workspace}.${getSaasConfig().domain}`, trialEndsAt, checkoutEnabled: getSaasConfig().checkoutEnabled };
  } catch (error) {
    await signups.updateOne({ _id: pending._id }, { $set: { state: 'pending' } });
    throw error;
  }
};

export const authenticateWorkspaceOwner = async (input: unknown) => {
  const args = signupSchema.pick({ email: true, workspace: true }).extend({ password: verifySchema.shape.password }).parse(input);
  const { organizations } = await getSaasStores();
  const organization = await organizations.findOne({ subdomain: args.workspace, racoManaged: true });
  if (!organization || organization.racoStatus === 'provisioning') throw new Error('Workspace or credentials are incorrect');
  const models = await tenantModels(organization);
  const owner = await models.Users.findOne({ email: args.email, isOwner: true, isActive: true });
  if (!owner || !await models.Users.comparePassword(args.password, owner.password)) throw new Error('Workspace or credentials are incorrect');
  return { organization, owner };
};

export const workspaceAccount = async (input: unknown) => {
  const { organization } = await authenticateWorkspaceOwner(input);
  const { payments } = await getSaasStores();
  const recentPayments = await payments.find({ organizationId: organization._id }).sort({ createdAt: -1 }).limit(5)
    .select('_id amountPoisha currency interval status createdAt').lean();
  return { workspace: organization.subdomain, planId: organization.racoPlanId,
    status: organization.racoStatus === 'trialing' && (!organization.racoTrialEndsAt || organization.racoTrialEndsAt.getTime() <= Date.now()) ? 'trial_expired'
      : organization.racoStatus === 'active' && (!organization.racoPaidUntil || organization.racoPaidUntil.getTime() <= Date.now()) ? 'payment_expired' : organization.racoStatus,
    trialEndsAt: organization.racoTrialEndsAt, paidUntil: organization.racoPaidUntil,
    payments: recentPayments.map(payment => ({ transactionId: payment._id, amount: payment.amountPoisha / 100,
      currency: payment.currency, interval: payment.interval, status: payment.status, createdAt: payment.createdAt })),
    checkoutEnabled: getSaasConfig().checkoutEnabled, workspaceUrl: `https://${organization.subdomain}.${getSaasConfig().domain}` };
};
