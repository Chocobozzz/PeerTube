import { AccessDeniedError, InvalidGrantError } from '@node-oauth/oauth2-server'
import { pick } from '@peertube/peertube-core-utils'
import { UserRegistrationState } from '@peertube/peertube-models'
import { isOTPValid } from '@server/helpers/otp.js'
import { UserRegistrationModel } from '@server/models/user/user-registration.js'
import { AuthenticatedResultUpdaterFieldName, RegisterServerAuthenticatedResult } from '@server/types/index.js'
import { MUser, MUserDefault } from '@server/types/models/user/user.js'
import express from 'express'
import { createLogger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { OTP } from '../../initializers/constants.js'
import { runTransaction } from '../../helpers/database-utils.js'
import { OAuthTokenModel } from '../../models/oauth/oauth-token.js'
import { UserModel } from '../../models/user/user.js'
import { Emailer } from '../emailer.js'
import { findAvailableLocalActorName } from '../local-actor.js'
import { Redis } from '../redis/index.js'
import { buildUser, createUserAccountAndChannelAndPlaylist, getByEmailPermissive } from '../user.js'
import { isRootAuthDisabled } from './auth-utils.js'
import { BypassLogin, UserUpdaterResults } from './bypass-login.model.js'
import { ExternalUser } from './external-user.model.js'
import {
  AccountBlockedError,
  EmailNotVerifiedError,
  InvalidTwoFactorError,
  MissingTwoFactorError,
  RegistrationApprovalRejected,
  RegistrationWaitingForApproval
} from './oauth-errors.js'

const logger = createLogger()

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
    const user = await handleGetUserBypass({ bypassLogin, req, oauthHeaders })

    // Continue the password process if handleGetUserBypass returns undefined,
    // which means the user does not belong to the plugin and we should go through a regular login process
    if (user) return user
  }

  logger.debug('Getting User (username/email: ' + usernameOrEmail + ', password: ******).')

  const users = await UserModel.listByUsernameOrEmailCaseInsensitive(usernameOrEmail)
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

  await checkLoginNotLockedOrThrow(user, req)

  const passwordMatch = await user.isPasswordMatch(password)
  if (passwordMatch !== true) {
    if (CONFIG.RATES_LIMIT.LOGIN_LOCKOUT.ENABLED) {
      const failures = await Redis.Instance.addLoginFailure(user.id, req.ip)
      await notifyAccountLockedIfNeeded(user, failures, req.ip)
    }

    throwInvalidGrantError()
  }

  checkUserNotBlockedOrThrow(user, req)

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION && user.emailVerified === false) {
    throw new EmailNotVerifiedError(req.t('User email is not verified.'))
  }

  await checkTwoFactorOrThrow(user, oauthHeaders, req)

  await Redis.Instance.deleteLoginFailures(user.id)

  return user
}

async function checkLoginNotLockedOrThrow (user: MUserDefault, req: express.Request) {
  if (!CONFIG.RATES_LIMIT.LOGIN_LOCKOUT.ENABLED) return
  if (await Redis.Instance.getLoginFailures(user.id) < CONFIG.RATES_LIMIT.LOGIN_LOCKOUT.MAX) return

  // Prevent a username-enumeration oracle
  throw new InvalidGrantError(req.t('Invalid grant: user credentials are invalid'))
}

async function checkTwoFactorOrThrow (user: MUserDefault, oauthHeaders: Record<string, string>, req: express.Request) {
  if (!user.otpSecret) return

  if (!oauthHeaders[OTP.HEADER_NAME]) {
    throw new MissingTwoFactorError(req.t('Missing two factor header'))
  }

  if (await isOTPValid({ encryptedSecret: user.otpSecret, token: oauthHeaders[OTP.HEADER_NAME] }) === true) return

  if (CONFIG.RATES_LIMIT.LOGIN_LOCKOUT.ENABLED) {
    const failures = await Redis.Instance.addLoginFailure(user.id, req.ip)
    await notifyAccountLockedIfNeeded(user, failures, req.ip)
  }

  throw new InvalidTwoFactorError(req.t('Invalid two factor header'))
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
  bypassLogin: BypassLogin
  req: express.Request
  oauthHeaders: Record<string, string>
}) {
  const { bypassLogin, req, oauthHeaders } = options

  logger.info('Bypassing oauth login by plugin %s.', bypassLogin.pluginName)

  const { pluginName, user: externalUser, userUpdaterResults } = bypassLogin

  const existing = await loadExistingExternalUser({ pluginName, externalUser })
  if (!existing) return createUserFromExternal(pluginName, externalUser)

  const { user, matchedBy } = existing

  // If the user does not belongs to a plugin, then we just go through a regular login process
  if (user.pluginAuth === null) return undefined

  if (matchedBy === 'email' && user.pluginAuth === pluginName && externalUser.externalId && user.pluginAuthExternalId !== null) {
    // This account is already linked to a different external id for this plugin
    // Refuse to silently relink (identity provider email reuse, or a possible hijack attempt)
    throw new AccessDeniedError(
      req.t(
        `Refusing external auth bypass for plugin {pluginName}: {email} is already linked to a different external id.`,
        { pluginName, email: externalUser.email }
      )
    )
  }

  checkUserNotBlockedOrThrow(user, req)

  // This user does not belong to this plugin
  const isCrossProvider = user.pluginAuth !== pluginName
  if (isCrossProvider && CONFIG.USER.ALLOW_CROSS_PROVIDER_AUTH !== true) {
    logger.info(
      'Cannot bypass oauth login by plugin %s because %s has another plugin auth method (%s).',
      pluginName,
      externalUser.email,
      user.pluginAuth
    )

    throw new AccessDeniedError(
      req.t('Cannot bypass oauth login by plugin {pluginName}: this account already uses another auth plugin.', { pluginName })
    )
  }

  await checkLoginNotLockedOrThrow(user, req)

  // Only id and pass logins (even from auth plugins) are supported for OTP
  if (bypassLogin.type === 'id-and-pass') {
    await checkTwoFactorOrThrow(user, oauthHeaders, req)
  }

  // ---------------------------------------------------------------------------
  // The user is now authenticated: apply the changes coming from the plugin
  // ---------------------------------------------------------------------------

  if (isCrossProvider) {
    logger.info(
      'Allowing cross authentication login for %s using plugin %s despite being known from plugin %s',
      externalUser.email,
      pluginName,
      user.pluginAuth
    )

    user.pluginAuth = pluginName
    await updateUserFromExternal({ user, userOptions: externalUser, userUpdaterResults, syncEmail: true, req })

    // Tokens issued under the previous auth plugin can no longer have their validity checked by that
    // plugin's hookTokenValidity (the user is not registered under it anymore), so force a fresh login
    await OAuthTokenModel.deleteUserToken({ userId: user.id })
  } else {
    // Authoritative match by stable external id: trust it even if the email changed at the identity provider
    await updateUserFromExternal({ user, userOptions: externalUser, userUpdaterResults, syncEmail: matchedBy === 'external-id', req })
  }

  await Redis.Instance.deleteLoginFailures(user.id)

  return user
}

// ---------------------------------------------------------------------------

// Run the userUpdater function of an auth plugin against the account the login bypass will update
// Can be consumed by another process on login
export async function computeUserUpdaterResults (options: {
  pluginName: string
  externalUser: ExternalUser
  userUpdater: RegisterServerAuthenticatedResult['userUpdater']
}): Promise<UserUpdaterResults> {
  const { pluginName, externalUser, userUpdater } = options

  if (!userUpdater) return undefined

  const existing = await loadExistingExternalUser({ pluginName, externalUser })

  // No account to update yet: the login bypass creates it from the plugin values, without calling the updater
  if (!existing) return { userId: null, fields: [] }

  return {
    userId: existing.user.id,

    fields: listUserUpdaterFields(existing.user, externalUser)
      .map(({ fieldName, currentValue, newValue }) => ({
        fieldName,
        currentValue,
        value: userUpdater({ fieldName, currentValue, newValue })
      }))
  }
}

async function loadExistingExternalUser (options: {
  pluginName: string
  externalUser: ExternalUser
}): Promise<{ user: MUserDefault, matchedBy: 'external-id' | 'email' }> {
  const { pluginName, externalUser } = options

  if (externalUser.externalId) {
    const userByExternalId = await UserModel.loadByPluginAuthExternalId(pluginName, externalUser.externalId)
    if (userByExternalId) return { user: userByExternalId, matchedBy: 'external-id' }
  }

  // Plugin does not supply a stable external id, or the account is not linked yet: unchanged email-only behavior
  const userByEmail = getByEmailPermissive(await UserModel.loadByEmailCaseInsensitive(externalUser.email), externalUser.email)
  if (userByEmail) return { user: userByEmail, matchedBy: 'email' }

  return undefined
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
  userUpdaterResults: UserUpdaterResults
  syncEmail: boolean
  req: express.Request
}) {
  const { user, userOptions, syncEmail, req } = options

  const fields = listUserUpdaterFields(user, userOptions)
  const values = resolveUserUpdaterValues({ ...pick(options, [ 'user', 'userUpdaterResults', 'req' ]), fields })

  if (values) {
    fields.forEach((field, i) => field.apply(values[i]))

    logger.debug('Updated user %s with plugin userUpdated function.', user.email, { user, userOptions })
  }

  if (userOptions.externalId && user.pluginAuthExternalId !== userOptions.externalId) {
    logger.info('Linking external id for user %s (plugin %s).', user.email, user.pluginAuth)
    user.set('pluginAuthExternalId', userOptions.externalId)
  }

  if (syncEmail && userOptions.email && user.email !== userOptions.email) {
    await checkExternalEmailIsFreeOrThrow(user, userOptions.email, req)

    logger.info('Updating email of user %s to %s after successful external auth.', user.email, userOptions.email)
    user.email = userOptions.email
  }

  return runTransaction(async transaction => {
    user.Account = await user.Account.save({ transaction })

    return user.save({ transaction })
  })
}

// The fields a plugin userUpdater function decides of
function listUserUpdaterFields (user: MUserDefault, userOptions: ExternalUser) {
  const userFields = [ 'role', 'adminFlags', 'videoQuota', 'videoQuotaDaily', 'language' ] as const

  return [
    ...userFields.map(fieldName => ({
      fieldName: fieldName as AuthenticatedResultUpdaterFieldName,
      currentValue: user[fieldName] as any,
      newValue: userOptions[fieldName] as any,
      apply: (value: any) => user.set(fieldName, value)
    })),

    {
      fieldName: 'displayName' as AuthenticatedResultUpdaterFieldName,
      currentValue: user.Account.name as any,
      newValue: userOptions.displayName as any,
      apply: (value: any) => user.Account.set('name', value)
    }
  ]
}

function resolveUserUpdaterValues (options: {
  user: MUserDefault
  fields: ReturnType<typeof listUserUpdaterFields>
  userUpdaterResults: UserUpdaterResults
  req: express.Request
}): any[] {
  const { user, fields, userUpdaterResults, req } = options

  if (!userUpdaterResults) return undefined

  const findResult = (fieldName: AuthenticatedResultUpdaterFieldName) => userUpdaterResults.fields.find(r => r.fieldName === fieldName)

  // The results were computed against the account in the past. If it changed, refuse to apply them
  const upToDate = userUpdaterResults.userId === user.id &&
    fields.every(({ fieldName, currentValue }) => {
      const result = findResult(fieldName)

      return !!result && isSameUserValue(result.currentValue, currentValue)
    })

  if (!upToDate) {
    logger.info(
      'Cannot apply the user updater results of plugin %s to %s: the account changed after the authentication.',
      user.pluginAuth,
      user.email
    )

    throw new InvalidGrantError(req.t('Your account changed during the authentication, please log in again'))
  }

  return fields.map(({ fieldName }) => findResult(fieldName).value)
}

// The results went through JSON to be stored with the external auth token
function isSameUserValue (a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

async function checkExternalEmailIsFreeOrThrow (user: MUserDefault, email: string, req: express.Request) {
  const others = (await UserModel.loadByEmailCaseInsensitive(email)).filter(u => u.id !== user.id)
  if (others.length === 0) return

  logger.error('Cannot sync email %s of user %s after external auth: already used by user %s.', email, user.email, others[0].id)

  throw new AccessDeniedError(
    req.t('Refusing external auth bypass: {email} is already used by another account.', { email })
  )
}

export function checkUserNotBlockedOrThrow (user: MUser, req: express.Request) {
  if (user.blocked) throw new AccountBlockedError(req.t('User is blocked.'))
}
