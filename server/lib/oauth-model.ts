import { OAuthClientInstance, UserInstance } from '../models'
import { database as db } from '../initializers/database'
import { logger } from '../helpers'

type TokenInfo = { accessToken: string, refreshToken: string, accessTokenExpiresAt: Date, refreshTokenExpiresAt: Date }

// ---------------------------------------------------------------------------

function getAccessToken (bearerToken: string) {
  logger.debug('Getting access token (bearerToken: ' + bearerToken + ').')

  return db.OAuthToken.getByTokenAndPopulateUser(bearerToken)
}

function getClient (clientId: string, clientSecret: string) {
  logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + clientSecret + ').')

  return db.OAuthClient.getByIdAndSecret(clientId, clientSecret)
}

function getRefreshToken (refreshToken: string) {
  logger.debug('Getting RefreshToken (refreshToken: ' + refreshToken + ').')

  return db.OAuthToken.getByRefreshTokenAndPopulateClient(refreshToken)
}

function getUser (username: string, password: string) {
  logger.debug('Getting User (username: ' + username + ', password: ******).')

  return db.User.getByUsername(username).then(user => {
    if (!user) return null

    return user.isPasswordMatch(password).then(passwordMatch => {
      if (passwordMatch === false) return null

      return user
    })
  })
}

function revokeToken (token: TokenInfo) {
  return db.OAuthToken.getByRefreshTokenAndPopulateUser(token.refreshToken).then(tokenDB => {
    if (tokenDB) tokenDB.destroy()

    /*
      * Thanks to https://github.com/manjeshpv/node-oauth2-server-implementation/blob/master/components/oauth/mongo-models.js
      * "As per the discussion we need set older date
      * revokeToken will expected return a boolean in future version
      * https://github.com/oauthjs/node-oauth2-server/pull/274
      * https://github.com/oauthjs/node-oauth2-server/issues/290"
    */
    const expiredToken = tokenDB
    expiredToken.refreshTokenExpiresAt = new Date('2015-05-28T06:59:53.000Z')

    return expiredToken
  })
}

function saveToken (token: TokenInfo, client: OAuthClientInstance, user: UserInstance) {
  logger.debug('Saving token ' + token.accessToken + ' for client ' + client.id + ' and user ' + user.id + '.')

  const tokenToCreate = {
    accessToken: token.accessToken,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    refreshToken: token.refreshToken,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
    oAuthClientId: client.id,
    userId: user.id
  }

  return db.OAuthToken.create(tokenToCreate).then(tokenCreated => {
    const tokenToReturn = Object.assign(tokenCreated, { client, user })

    return tokenToReturn
  })
}

// ---------------------------------------------------------------------------

// See https://github.com/oauthjs/node-oauth2-server/wiki/Model-specification for the model specifications
export {
  getAccessToken,
  getClient,
  getRefreshToken,
  getUser,
  revokeToken,
  saveToken
}
