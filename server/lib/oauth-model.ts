import { database as db } from '../initializers/database'
import { logger } from '../helpers'

// ---------------------------------------------------------------------------

function getAccessToken (bearerToken) {
  logger.debug('Getting access token (bearerToken: ' + bearerToken + ').')

  return db.OAuthToken.getByTokenAndPopulateUser(bearerToken)
}

function getClient (clientId, clientSecret) {
  logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + clientSecret + ').')

  return db.OAuthClient.getByIdAndSecret(clientId, clientSecret)
}

function getRefreshToken (refreshToken) {
  logger.debug('Getting RefreshToken (refreshToken: ' + refreshToken + ').')

  return db.OAuthToken.getByRefreshTokenAndPopulateClient(refreshToken)
}

function getUser (username, password) {
  logger.debug('Getting User (username: ' + username + ', password: ' + password + ').')

  return db.User.getByUsername(username).then(function (user) {
    if (!user) return null

    // We need to return a promise
    return new Promise(function (resolve, reject) {
      return user.isPasswordMatch(password, function (err, isPasswordMatch) {
        if (err) return reject(err)

        if (isPasswordMatch === true) {
          return resolve(user)
        }

        return resolve(null)
      })
    })
  })
}

function revokeToken (token) {
  return db.OAuthToken.getByRefreshTokenAndPopulateUser(token.refreshToken).then(function (tokenDB) {
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

function saveToken (token, client, user) {
  logger.debug('Saving token ' + token.accessToken + ' for client ' + client.id + ' and user ' + user.id + '.')

  const tokenToCreate = {
    accessToken: token.accessToken,
    accessTokenExpiresAt: token.accessTokenExpiresAt,
    refreshToken: token.refreshToken,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt,
    oAuthClientId: client.id,
    userId: user.id
  }

  return db.OAuthToken.create(tokenToCreate).then(function (tokenCreated: any) {
    tokenCreated.client = client
    tokenCreated.user = user

    return tokenCreated
  }).catch(function (err) {
    throw err
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
