import { CONFIG } from '@server/initializers/config.js'
import { PluginManager } from '@server/lib/plugins/plugin-manager.js'
import { MUser } from '@server/types/models/user/user.js'
import { Redis } from '../redis/index.js'
import { isExternalUserPasswordValid } from './external-auth.js'

export function canUserConfirmPassword (user: MUser) {
  if (!user.pluginAuth) return true

  return PluginManager.Instance.getIdAndPassAuths().some(p => p.npmName === user.pluginAuth)
}

export function isUserCurrentPasswordValid (user: MUser, password: string) {
  return user.pluginAuth
    ? isExternalUserPasswordValid({ user, password })
    : user.isPasswordMatch(password)
}

// ---------------------------------------------------------------------------

export async function consumePasswordConfirmationAttempt (user: MUser) {
  if (!CONFIG.RATES_LIMIT.PASSWORD_CONFIRMATION.ENABLED) return true

  const { totalHits } = await Redis.Instance.incrementRateLimit({
    key: buildFailuresKey(user),
    hits: 1,
    windowMs: CONFIG.RATES_LIMIT.PASSWORD_CONFIRMATION.WINDOW_MS
  })

  return totalHits <= CONFIG.RATES_LIMIT.PASSWORD_CONFIRMATION.MAX
}

export async function resetPasswordConfirmationFailures (user: MUser) {
  if (!CONFIG.RATES_LIMIT.PASSWORD_CONFIRMATION.ENABLED) return

  await Redis.Instance.resetRateLimit(buildFailuresKey(user))
}

// ---------------------------------------------------------------------------

function buildFailuresKey (user: MUser) {
  return 'password-confirmation-failures-' + user.id
}
