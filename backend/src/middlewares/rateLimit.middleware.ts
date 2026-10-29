import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse';

/**
 * ARCHITECTURAL NOTES ON RATE LIMITING:
 *
 * 1. Default In-Memory Store:
 *    The default MemoryStore in express-rate-limit keeps tracking state in the local process memory.
 *    In multi-instance deployments (e.g. Kubernetes pods, PM2 cluster mode, load-balanced containers),
 *    rate limiting state is NOT shared across instances. For distributed production environments,
 *    an external shared store like Redis (via rate-limit-redis) must be configured.
 *
 * 2. Reverse Proxies & Trust Proxy:
 *    express-rate-limit determines client IP addresses via req.ip. If the application is hosted
 *    behind a reverse proxy (e.g., Cloudflare, NGINX, AWS ALB), Express's `trust proxy` setting
 *    must be configured to the exact CIDR range of your proxy rather than boolean `true`
 *    to prevent attackers from spoofing X-Forwarded-For headers.
 */

export function createLoginRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    limit: 5, // Maximum 5 requests per IP address in the window
    standardHeaders: 'draft-6', // Return standard RateLimit-* headers
    legacyHeaders: true, // Enable X-RateLimit-* headers
    handler: (_req, res, _next, options) => {
      res.setHeader('RateLimit-Limit', String(options?.limit ?? 5));
      res.setHeader('RateLimit-Remaining', '0');
      sendError(
        res,
        429,
        'Too many login attempts from this IP. Please try again after 15 minutes.'
      );
    },
  });
}

export const loginRateLimiter = createLoginRateLimiter();
