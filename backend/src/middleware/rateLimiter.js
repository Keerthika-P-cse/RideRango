/**
 * In-Memory Login Rate Limiter Middleware
 * Protects login endpoints from brute-force attempts.
 * Limits failed attempts to 5 per 15 minutes per IP.
 * Zero external dependencies.
 */

class LoginRateLimiter {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 5
    this.windowMs = options.windowMs || 15 * 60 * 1000 // 15 minutes
    this.message = options.message || 'Too many login attempts. Please try again after 15 minutes.'
    this.attempts = new Map()

    // Periodic sweep to prevent memory buildup (every 5 minutes)
    setInterval(() => this.cleanup(), 5 * 60 * 1000).unref()
  }

  cleanup() {
    const now = Date.now()
    for (const [ip, timestamps] of this.attempts.entries()) {
      const active = timestamps.filter(t => now - t < this.windowMs)
      if (active.length === 0) {
        this.attempts.delete(ip)
      } else {
        this.attempts.set(ip, active)
      }
    }
  }

  getIp(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    )
  }

  middleware() {
    return (req, res, next) => {
      const ip = this.getIp(req)
      const now = Date.now()

      const history = (this.attempts.get(ip) || []).filter(t => now - t < this.windowMs)
      this.attempts.set(ip, history)

      // Check if IP is currently rate-limited
      if (history.length >= this.maxAttempts) {
        const oldestAttempt = history[0]
        const remainingMinutes = Math.max(1, Math.ceil((this.windowMs - (now - oldestAttempt)) / (60 * 1000)))
        return res.status(429).json({
          success: false,
          message: `Too many failed login attempts. Please try again after ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
          timestamp: new Date().toISOString()
        })
      }

      // Track response: only count failed authentications (401)
      res.on('finish', () => {
        if (res.statusCode === 401) {
          const current = this.attempts.get(ip) || []
          current.push(Date.now())
          this.attempts.set(ip, current)
        } else if (res.statusCode >= 200 && res.statusCode < 300) {
          // On successful authentication, reset failed attempts counter for this IP
          this.attempts.delete(ip)
        }
      })

      next()
    }
  }
}

// Separate rate limiter instances for customer and staff portals
export const customerLoginLimiter = new LoginRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Too many failed customer login attempts. Please try again after 15 minutes.'
}).middleware()

export const staffLoginLimiter = new LoginRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  message: 'Too many failed staff login attempts. Please try again after 15 minutes.'
}).middleware()

export default {
  customerLoginLimiter,
  staffLoginLimiter
}
