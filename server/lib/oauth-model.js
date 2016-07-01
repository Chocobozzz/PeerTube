const mongoose = require('mongoose')

const logger = require('../helpers/logger')

const OAuthClient = mongoose.model('OAuthClient')
const OAuthToken = mongoose.model('OAuthToken')
const User = mongoose.model('User')

// See https://github.com/oauthjs/node-oauth2-server/wiki/Model-specification for the model specifications
const OAuthModel = {
  getAccessToken: getAccessToken,
  getClient: getClient,
  getRefreshToken: getRefreshToken,
  getUser: getUser,
  saveToken: saveToken
}

// ---------------------------------------------------------------------------

function getAccessToken (bearerToken) {
  logger.debug('Getting access token (bearerToken: ' + bearerToken + ').')

  return OAuthToken.loadByTokenAndPopulateUser(bearerToken)
}

function getClient (clientId, clientSecret) {
  logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + clientSecret + ').')

  // TODO req validator
  const mongoId = new mongoose.mongo.ObjectID(clientId)
  return OAuthClient.loadByIdAndSecret(mongoId, clientSecret)
}

function getRefreshToken (refreshToken) {
  logger.debug('Getting RefreshToken (refreshToken: ' + refreshToken + ').')

  return OAuthToken.loadByRefreshToken(refreshToken)
}

function getUser (username, password) {
  logger.debug('Getting User (username: ' + username + ', password: ' + password + ').')

  return User.loadByUsernameAndPassword(username, password)
}

function saveToken (token, client, user) {
  logger.debug('Saving token for client ' + client.id + ' and user ' + user.id + '.')

  const tokenObj = new OAuthToken({
    accessToken: token.accessToken,
    accessTokenExpiresOn: token.accessTokenExpiresOn,
    client: client.id,
    refreshToken: token.refreshToken,
    refreshTokenExpiresOn: token.refreshTokenExpiresOn,
    user: user.id
  })

  return tokenObj.save(function (err, tokenCreated) {
    if (err) throw err // node-oauth2-server library uses Promise.try

    tokenCreated.client = client
    tokenCreated.user = user

    return tokenCreated
  })
}

// ---------------------------------------------------------------------------

module.exports = OAuthModel
