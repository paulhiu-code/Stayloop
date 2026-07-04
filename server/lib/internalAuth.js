/**
 * Guards sensitive operational endpoints (detailed health checks, etc.).
 * Requires HEALTH_CHECK_SECRET when set; otherwise allows only in non-production.
 */
export function assertInternalAccess(req) {
  const secret = process.env.HEALTH_CHECK_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw Object.assign(new Error('Health check is not configured'), { statusCode: 503 });
    }
    return;
  }

  const authHeader = req.headers?.authorization ?? '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = req.headers?.['x-health-check-secret'] ?? '';

  if (bearer !== secret && headerSecret !== secret) {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
}
