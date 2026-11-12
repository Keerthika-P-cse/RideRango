/**
 * Shared database transaction helpers for deadlock detection and safe bounded retry.
 */

const DEADLOCK_ERRNOS = new Set([1213, 1205, 9007, 8028])
const DEADLOCK_CODES = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'])

export const isDeadlockOrLockError = (err) => {
  if (!err) return false
  if (DEADLOCK_CODES.has(err.code) || DEADLOCK_ERRNOS.has(err.errno)) {
    return true
  }
  const msg = String(err.message || '')
  return /deadlock found|lock wait timeout|write conflict/i.test(msg)
}

/**
 * Execute an async transactional operation with bounded retry on DB deadlock/lock-conflict errors.
 * The wrapped function MUST manage its own beginTransaction / rollback / release per invocation.
 */
export const withDeadlockRetry = async (operation, { maxRetries = 2, baseDelayMs = 20 } = {}) => {
  let attempt = 0
  while (true) {
    try {
      return await operation()
    } catch (err) {
      if (!isDeadlockOrLockError(err)) {
        throw err
      }
      if (attempt >= maxRetries) {
        const conflictErr = new Error('Concurrent booking/payment update conflict. Please retry your request.')
        conflictErr.statusCode = 409
        conflictErr.code = err.code || 'ER_LOCK_DEADLOCK'
        conflictErr.cause = err
        throw conflictErr
      }
      attempt += 1
      if (baseDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt))
      }
    }
  }
}
