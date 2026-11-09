import { UserRole } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { MUser } from '@server/types/models/index.js'

export function isRootAuthDisabled (user: Pick<MUser, 'username'>) {
  return CONFIG.USER.DISABLE_ROOT_AUTH === true && user.username === 'root'
}

// Administrators bypass email verification
export function isEmailVerificationRequiredFor (user: Pick<MUser, 'role'>) {
  return CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION === true && user.role !== UserRole.ADMINISTRATOR
}

export function hasUnverifiedEmail (user: Pick<MUser, 'role' | 'emailVerified'>) {
  return isEmailVerificationRequiredFor(user) && user.emailVerified === false
}
