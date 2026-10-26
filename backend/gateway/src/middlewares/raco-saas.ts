import { RequestHandler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Mounted before tenant authentication, on this exact public API prefix only.
export const racoSaasProxy: RequestHandler = (req, res, next) => {
  if (process.env.VERSION !== 'saas' || process.env.RACO_SAAS_ENABLED !== 'true') return res.sendStatus(404);
  return createProxyMiddleware({
    target: process.env.RACO_SAAS_CORE_URL || 'http://127.0.0.1:3300',
    changeOrigin: true,
    pathRewrite: requestPath => `/saas${requestPath}`,
  })(req, res, next);
};
