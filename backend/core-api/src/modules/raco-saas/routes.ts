import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { getSaasConfig } from './config';
import { requestWorkspace, verifyWorkspace, workspaceAccount } from './service';
import { startCheckout, settleSslPayment } from './billing';

export const racoSaasRouter: Router = Router();
racoSaasRouter.use((_req, res, next) => {
  if (process.env.VERSION !== 'saas' || process.env.RACO_SAAS_ENABLED !== 'true') return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  return next();
});
// Provider callbacks have a separate limit; they never authorize CRM requests.
racoSaasRouter.post('/sslcommerz/ipn', rateLimit({ windowMs: 15 * 60000, limit: 1000, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
  try { return res.json(await settleSslPayment(req.body)); }
  catch (error) {
    const invalid = error instanceof Error && /signature|notification|match|validation ID/.test(error.message);
    return res.status(invalid ? 400 : 503).json({ error: invalid ? 'Payment notification rejected' : 'Payment validation is temporarily unavailable' });
  }
});
racoSaasRouter.all('/sslcommerz/return/:outcome', async (req, res) => {
  if (req.method === 'POST' && req.body?.verify_sign) {
    try { await settleSslPayment(req.body); } catch { /* The IPN can retry; a browser return never grants access by itself. */ }
  }
  return res.redirect(303, `https://${getSaasConfig().domain}/saas?payment=returned`);
});
racoSaasRouter.use(rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: true, legacyHeaders: false }));
racoSaasRouter.get('/config', (_req, res) => res.json(getSaasConfig()));
racoSaasRouter.post('/signup', rateLimit({ windowMs: 60 * 60000, limit: 5, standardHeaders: true, legacyHeaders: false }), async (req, res) => {
  try { return res.status(202).json(await requestWorkspace(req.body)); }
  catch (error) { return res.status(400).json({ error: error instanceof ZodError ? error.issues[0].message : 'Signup could not be completed. Check your workspace address or try again later.' }); }
});
racoSaasRouter.post('/verify', async (req, res) => {
  try { return res.status(201).json(await verifyWorkspace(req.body)); }
  catch (error) { return res.status(400).json({ error: error instanceof ZodError ? 'Use a valid verification link, your name, and a password of 12–72 characters with upper/lowercase letters and a number.' : 'Verification could not be completed. The link may be expired or the workspace may require operator review.' }); }
});
racoSaasRouter.post('/account', async (req, res) => {
  try { return res.json(await workspaceAccount(req.body)); }
  catch { return res.status(401).json({ error: 'Workspace or credentials are incorrect' }); }
});
racoSaasRouter.post('/checkout', async (req, res) => {
  if (!getSaasConfig().checkoutEnabled) return res.status(409).json({ error: 'SSLCommerz credentials and plan prices are not configured. No payment has been taken.' });
  try { return res.json(await startCheckout(req.body)); }
  catch { return res.status(400).json({ error: 'Checkout could not be started. Check the owner credentials, billing details and selected price. For a previous attempt, check workspace status before starting again.' }); }
});
