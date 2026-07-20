import { AccessDeniedError, InvalidGrantError } from '@node-oauth/oauth2-server'
import { pick } from '@peertube/peertube-core-utils'
import { UserRegistrationState } from '@peertube/peertube-models'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { isUserPasswordTooLong } from '@server/helpers/custom-validators/users.js'
import { isOTPValid } from '@server/helpers/otp.js'
import { AccountModel } from '@server/models/account/account.js'
import { UserRegistrationModel } from '@server/models/user/user-registration.js'
import { AuthenticatedResultUpdaterFieldName, RegisterServerAuthenticatedResult } from '@server/types/index.js'
import { MUser, MUserDefault } from '@server/types/models/user/user.js'
import express from 'express'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { OTP } from '../../initializers/constants.js'
import { OAuthTokenModel } from '../../models/oauth/oauth-token.js'
import { UserModel } from '../../models/user/user.js'
import { Emailer } from '../emailer.js'
import { findAvailableLocalActorName } from '../local-actor.js'
import { Redis } from '../redis.js'
import { buildUser, createUserAccountAndChannelAndPlaylist, getByEmailPermissive } from '../user.js'
import { isRootAuthDisabled } from './auth-utils.js'
import { BypassLogin } from './bypass-login.model.js'
import { ExternalUser } from './external-user.model.js'
import {
  AccountBlockedError,
  EmailNotVerifiedError,
  InvalidTwoFactorError,
  MissingTwoFactorError,
  RegistrationApprovalRejected,
  RegistrationWaitingForApproval,
  TooLongPasswordError
} from './oauth-errors.js'

export async function getUserOrThrow (options: {
  usernameOrEmail?: string
  password?: string
  bypassLogin?: BypassLogin
  req: express.Request
  oauthHeaders: Record<string, string>
}) {
  const { bypassLogin, req, usernameOrEmail, password, oauthHeaders } = options

  const throwInvalidGrantError = () => {
    throw new InvalidGrantError(req.t('Invalid grant: user credentials are invalid'))
  }

  // Special treatment coming from a plugin
  if (bypassLogin?.bypass === true) {
    const user = await handleGetUserBypass({ bypassLogin, req })

    // Continue the password process if handleGetUserBypass returns undefined,
    // which means the user does not belong to the plugin and we should go through a regular login process
    if (user) return user
  }

  logger.debug('Getting User (username/email: ' + usernameOrEmail + ', password: ******).')

  const users = await UserModel.loadByUsernameOrEmailCaseInsensitive(usernameOrEmail)
  const user = usernameOrEmail.includes('@')
    ? getByEmailPermissive(users, usernameOrEmail)
    : users[0]

  if (!user) {
    const registrations = await UserRegistrationModel.listByEmailCaseInsensitiveOrUsername(usernameOrEmail)

    if (registrations.length === 1) {
      if (registrations[0].state === UserRegistrationState.REJECTED) {
        throw new RegistrationApprovalRejected(req.t('Registration approval for this account has been rejected'))
      } else if (registrations[0].state === UserRegistrationState.PENDING) {
        throw new RegistrationWaitingForApproval(req.t('Registration for this account is awaiting approval'))
      }
    }

    throwInvalidGrantError()
  }

  // If we don't find the user, or if the user belongs to a plugin -> error
  if (user?.pluginAuth !== null || !password) throwInvalidGrantError()

  if (isRootAuthDisabled(user)) throwInvalidGrantError()

  // Check the per-account login failures counter so a locked account cannot have its password/OTP brute-forced
  // Throw the exact same generic error as invalid credentials: a distinct error/status here would let an
  // attacker use the lockout itself as a username-enumeration oracle (try N failed logins, see if it flips)
  if (await Redis.Instance.getLoginFailures(user.id) >= CONFIG.RATES_LIMIT.LOGIN_LOCKOUT.MAX) {
    throwInvalidGrantError()
  }

  if (isUserPasswordTooLong(password)) {
    throw new TooLongPasswordError(req.t('Password is too long. Please reset it using the password reset procedure.'))
  }

  const passwordMatch = await user.isPasswordMatch(password)
  if (passwordMatch !== true) {
    const failures = await Redis.Instance.addLoginFailure(user.id, req.ip)
    await notifyAccountLockedIfNeeded(user, failures, req.ip)

    throwInvalidGrantError()
  }

  checkUserNotBlockedOrThrow(user, req)

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION && user.emailVerified === false) {
    // Keep this message sync with the client
    throw new EmailNotVerifiedError(req.t('User email is not verified.'))
  }

  if (user.otpSecret) {
    if (!oauthHeaders[OTP.HEADER_NAME]) {
      throw new MissingTwoFactorError(req.t('Missing two factor header'))
    }

    if (await isOTPValid({ encryptedSecret: user.otpSecret, token: oauthHeaders[OTP.HEADER_NAME] }) !== true) {
      const failures = await Redis.Instance.addLoginFailure(user.id, req.ip)
      await notifyAccountLockedIfNeeded(user, failures, req.ip)

      throw new InvalidTwoFactorError(req.t('Invalid two factor header'))
    }
  }

  await Redis.Instance.deleteLoginFailures(user.id)

  return user
}

// This is the exact failure that just crossed the threshold and locked the account: notify its owner once per lock
function notifyAccountLockedIfNeeded (user: MUserDefault, failures: number, ip: string) {
  if (failures < CONFIG.RATES_LIMIT.LOGIN_LOCKOUT.MAX) return Promise.resolve()

  return Emailer.Instance.addAccountLoginLockedEmailJob({
    username: user.username,
    to: user.email,
    language: user.getLanguage(),
    ip
  })
}

async function handleGetUserBypass (options: {
  bypassLogin?: BypassLogin
  req: express.Request
}) {
  const { bypassLogin, req } = options

  logger.info('Bypassing oauth login by plugin %s.', bypassLogin.pluginName)

  const { pluginName, user: externalUser, userUpdater } = bypassLogin

  const user = await findExternalUserOrThrow({ externalUser, pluginName, userUpdater, req })

  // If the user does not belongs to a plugin, it was created before its installation
  // Then we just go through a regular login process
  if (user.pluginAuth !== null) {
    // This user does not belong to this plugin
    if (user.pluginAuth !== pluginName) {
      if (CONFIG.USER.ALLOW_CROSS_PROVIDER_AUTH !== true) {
        logger.info(
          'Cannot bypass oauth login by plugin %s because %s has another plugin auth method (%s).',
          pluginName,
          externalUser.email,
          user.pluginAuth
        )

        throw new AccessDeniedError(
          req.t('Cannot bypass oauth login by plugin {pluginName}: this account already uses another auth plugin.', { pluginName })
        )
      } else {
        logger.info(
          'Allowing cross authentication login for %s using plugin %s despite being known from plugin %s',
          bypassLogin.user.email,
          bypassLogin.pluginName,
          user.pluginAuth
        )

        user.pluginAuth = pluginName
        await updateUserFromExternal({ user, userOptions: externalUser, userUpdater, syncEmail: true })

        // Tokens issued under the previous auth plugin can no longer have their validity checked by that
        // plugin's hookTokenValidity (the user is not registered under it anymore), so force a fresh login
        await OAuthTokenModel.deleteUserToken({ userId: user.id })
      }
    }

    checkUserNotBlockedOrThrow(user, req)

    return user
  }

  return undefined
}

// ---------------------------------------------------------------------------

async function findExternalUserOrThrow (options: {
  externalUser: ExternalUser
  pluginName: string
  userUpdater: RegisterServerAuthenticatedResult['userUpdater']
  req: express.Request
}): Promise<MUserDefault> {
  const { externalUser, pluginName, userUpdater, req } = options

  if (externalUser.externalId) {
    const userByExternalId = await UserModel.loadByPluginAuthExternalId(pluginName, externalUser.externalId)

    if (userByExternalId) {
      // Authoritative match by stable external id: trust it even if the email changed at the identity provider
      return updateUserFromExternal({ user: userByExternalId, userOptions: externalUser, userUpdater, syncEmail: true })
    }
  }

  // Plugin does not supply a stable external id: unchanged email-only behavior
  const userByEmail = getByEmailPermissive(await UserModel.loadByEmailCaseInsensitive(externalUser.email), externalUser.email)
  if (!userByEmail) return createUserFromExternal(pluginName, externalUser)

  if (userByEmail.pluginAuth === pluginName) {
    if (externalUser.externalId && userByEmail.pluginAuthExternalId !== null) {
      // This account is already linked to a different external id for this plugin
      // Refuse to silently relink (identity provider email reuse, or a possible hijack attempt)
      throw new AccessDeniedError(
        req.t(
          `Refusing external auth bypass for plugin {pluginName}: {email} is already linked to a different external id.`,
          { pluginName, email: externalUser.email }
        )
      )
    }

    return updateUserFromExternal({ user: userByEmail, userOptions: externalUser, userUpdater, syncEmail: false })
  }

  return userByEmail
}

async function createUserFromExternal (pluginAuth: string, userOptions: ExternalUser) {
  const username = await findAvailableLocalActorName(userOptions.username)

  const userToCreate = buildUser({
    ...pick(userOptions, [ 'email', 'role', 'adminFlags', 'videoQuota', 'videoQuotaDaily', 'language' ]),

    username,
    emailVerified: null,
    password: null,
    pluginAuth,
    pluginAuthExternalId: userOptions.externalId
  })

  const { user } = await createUserAccountAndChannelAndPlaylist({
    userToCreate,
    userDisplayName: userOptions.displayName
  })

  return user
}

async function updateUserFromExternal (options: {
  user: MUserDefault
  userOptions: ExternalUser
  userUpdater: RegisterServerAuthenticatedResult['userUpdater']
  syncEmail: boolean
}) {
  const { user, userOptions, userUpdater, syncEmail } = options

  if (userUpdater) {
    {
      type UserAttributeKeys = keyof AttributesOnly<UserModel>
      const mappingKeys: { [id in UserAttributeKeys]?: AuthenticatedResultUpdaterFieldName } = {
        role: 'role',
        adminFlags: 'adminFlags',
        videoQuota: 'videoQuota',
        videoQuotaDaily: 'videoQuotaDaily',
        language: 'language'
      }

      for (const modelKey of Object.keys(mappingKeys)) {
        const pluginOptionKey = mappingKeys[modelKey]

        const newValue = userUpdater({ fieldName: pluginOptionKey, currentValue: user[modelKey], newValue: userOptions[pluginOptionKey] })
        user.set(modelKey, newValue)
      }
    }

    {
      type AccountAttributeKeys = keyof Partial<AttributesOnly<AccountModel>>
      const mappingKeys: { [id in AccountAttributeKeys]?: AuthenticatedResultUpdaterFieldName } = {
        name: 'displayName'
      }

      for (const modelKey of Object.keys(mappingKeys)) {
        const optionKey = mappingKeys[modelKey]

        const newValue = userUpdater({ fieldName: optionKey, currentValue: user.Account[modelKey], newValue: userOptions[optionKey] })
        user.Account.set(modelKey, newValue)
      }
    }

    logger.debug('Updated user %s with plugin userUpdated function.', user.email, { user, userOptions })
  }

  if (userOptions.externalId && user.pluginAuthExternalId !== userOptions.externalId) {
    logger.info('Linking external id for user %s (plugin %s).', user.email, user.pluginAuth)
    user.set('pluginAuthExternalId', userOptions.externalId)
  }

  if (syncEmail && userOptions.email && user.email !== userOptions.email) {
    logger.info('Updating email of user %s to %s after successful external auth.', user.email, userOptions.email)
    user.email = userOptions.email
  }

  user.Account = await user.Account.save()

  return user.save()
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function checkUserNotBlockedOrThrow (user: MUser, req: express.Request) {
  if (user.blocked) throw new AccountBlockedError(req.t('User is blocked.'))
}
