import * as Bluebird from 'bluebird'
import { AccessDeniedError } from 'oauth2-server'
import { logger } from '../helpers/logger'
import { UserModel } from '../models/account/user'
import { OAuthClientModel } from '../models/oauth/oauth-client'
import { OAuthTokenModel } from '../models/oauth/oauth-token'
import { CACHE } from '../initializers/constants'
import { Transaction } from 'sequelize'
import { CONFIG } from '../initializers/config'

type TokenInfo = { accessToken: string, refreshToken: string, accessTokenExpiresAt: Date, refreshTokenExpiresAt: Date }
let accessTokenCache: { [ accessToken: string ]: OAuthTokenModel } = {}
let userHavingToken: { [ userId: number ]: string } = {}

// ---------------------------------------------------------------------------

function deleteUserToken (userId: number, t?: Transaction) {
  clearCacheByUserId(userId)

  return OAuthTokenModel.deleteUserToken(userId, t)
}

function clearCacheByUserId (userId: number) {
  const token = userHavingToken[userId]
  if (token !== undefined) {
    accessTokenCache[ token ] = undefined
    userHavingToken[ userId ] = undefined
  }
}

function clearCacheByToken (token: string) {
  const tokenModel = accessTokenCache[ token ]
  if (tokenModel !== undefined) {
    userHavingToken[tokenModel.userId] = undefined
    accessTokenCache[ token ] = undefined
  }
}

function getAccessToken (bearerToken: string) {
  logger.debug('Getting access token (bearerToken: ' + bearerToken + ').')

  if (!bearerToken) return Bluebird.resolve(undefined)

  if (accessTokenCache[bearerToken] !== undefined) return Bluebird.resolve(accessTokenCache[bearerToken])

  return OAuthTokenModel.getByTokenAndPopulateUser(bearerToken)
    .then(tokenModel => {
      if (tokenModel) {
        // Reinit our cache
        if (Object.keys(accessTokenCache).length > CACHE.USER_TOKENS.MAX_SIZE) {
          accessTokenCache = {}
          userHavingToken = {}
        }

        accessTokenCache[ bearerToken ] = tokenModel
        userHavingToken[ tokenModel.userId ] = tokenModel.accessToken
      }

      return tokenModel
    })
}

function getClient (clientId: string, clientSecret: string) {
  logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + clientSecret + ').')

  return OAuthClientModel.getByIdAndSecret(clientId, clientSecret)
}

function getRefreshToken (refreshToken: string) {
  logger.debug('Getting RefreshToken (refreshToken: ' + refreshToken + ').')

  return OAuthTokenModel.getByRefreshTokenAndPopulateClient(refreshToken)
}

async function getUser (usernameOrEmail: string, password: string) {
  logger.debug('Getting User (username/email: ' + usernameOrEmail + ', password: ******).')

  const user = await UserModel.loadByUsernameOrEmail(usernameOrEmail)
  if (!user) return null

  const passwordMatch = await user.isPasswordMatch(password)
  if (passwordMatch === false) return null

  if (user.blocked) throw new AccessDeniedError('User is blocked.')

  if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION && user.emailVerified === false) {
    throw new AccessDeniedError('User email is not verified.')
  }

  return user
}

async function revokeToken (tokenInfo: TokenInfo) {
  const token = await OAuthTokenModel.getByRefreshTokenAndPopulateUser(tokenInfo.refreshToken)
  if (token) {
    clearCacheByToken(token.accessToken)

    token.destroy()
         .catch(err => logger.error('Cannot destroy token when revoking token.', { err }))
  }

  /*
    * Thanks to https://github.com/manjeshpv/node-oauth2-server-implementation/blob/master/components/oauth/mongo-models.js
    * "As per the discussion we need set older date
    * revokeToken will expected return a boolean in future version
    * https://github.com/oauthjs/node-oauth2-server/pull/274
    * https://github.com/oauthjs/node-oauth2-server/issues/290"
  */
  const expiredToken = token
  expiredToken.refreshTokenExpiresAt = new Date('2015-05-28T06:59:53.000Z')

  return expiredToken
}

async function saveToken (token: TokenInfo, client: OAuthClientModel, user: UserModel) {
  logger.debug('Saving token ' + token.accessToken + ' for client ' + client.id + ' and user ' + user.id + '.')

  const tokenToCreate = {
    accessToken: token.accessToken,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    refreshToken: token.refreshToken,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
    oAuthClientId: client.id,
    userId: user.id
  }

  const tokenCreated = await OAuthTokenModel.create(tokenToCreate)
  return Object.assign(tokenCreated, { client, user })
}

// ---------------------------------------------------------------------------

// See https://github.com/oauthjs/node-oauth2-server/wiki/Model-specification for the model specifications
export {
  deleteUserToken,
  clearCacheByUserId,
  clearCacheByToken,
  getAccessToken,
  getClient,
  getRefreshToken,
  getUser,
  revokeToken,
  saveToken
}
