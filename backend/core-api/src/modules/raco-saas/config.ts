import { z } from 'zod';
import { sslSettings } from './sslcommerz';

const planSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
  name: z.string().min(1).max(60),
  description: z.string().max(300),
  monthlyPrice: z.number().nonnegative().max(10000000).multipleOf(0.01).nullable(),
  yearlyPrice: z.number().nonnegative().max(10000000).multipleOf(0.01).nullable().optional().default(null),
  currency: z.literal('BDT'),
  seats: z.number().int().min(1).max(10000),
  features: z.array(z.string().max(100)).max(20),
});

export const getSaasConfig = () => {
  const domain = process.env.RACO_SAAS_DOMAIN || 'xos.racoai.io';
  if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) throw new Error('Invalid RACO_SAAS_DOMAIN');
  const defaults = [{ id: 'standard', name: 'Standard', description: 'CRM, inbox and AI workflows', monthlyPrice: null,
    currency: 'BDT', seats: 5, features: ['Contacts and customer workspaces', 'Team inbox', 'AI workflow drafts with human approval'] }];
  const plans = z.array(planSchema).min(1).parse(process.env.RACO_SAAS_PLANS ? JSON.parse(process.env.RACO_SAAS_PLANS) : defaults);
  if (new Set(plans.map(plan => plan.id)).size !== plans.length) throw new Error('Duplicate SaaS plan IDs');
  const payment = sslSettings();
  return { domain, trialDays: 14, checkoutEnabled: payment.enabled && plans.some(plan => (plan.monthlyPrice || 0) > 0 || (plan.yearlyPrice || 0) > 0),
    paymentProvider: 'SSLCommerz', paymentMode: payment.mode, billingIntervals: ['monthly', 'yearly'], plans };
};

const reserved = new Set(['www', 'api', 'admin', 'mail', 'smtp', 'support', 'billing', 'status', 'signup', 'login', 'xos', 'localhost', 'test', 'saas']);
export const signupSchema = z.object({
  company: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  workspace: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9-]{2,30}[a-z0-9]$/)
    .refine(value => !reserved.has(value), 'Choose a different workspace address'),
  planId: z.string().min(1),
});
export const verifySchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  firstName: z.string().trim().min(1).max(80),
  password: z.string().min(12).max(72).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
});
