const mongoose = require('mongoose')

const logger = require('../helpers/logger')

// ---------------------------------------------------------------------------

const oAuthTokensSchema = mongoose.Schema({
  accessToken: String,
  accessTokenExpiresOn: Date,
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'oAuthClients' },
  refreshToken: String,
  refreshTokenExpiresOn: Date,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' }
})
const OAuthTokensDB = mongoose.model('oAuthTokens', oAuthTokensSchema)

const oAuthClientsSchema = mongoose.Schema({
  clientSecret: String,
  grants: Array,
  redirectUris: Array
})
const OAuthClientsDB = mongoose.model('oAuthClients', oAuthClientsSchema)

const usersSchema = mongoose.Schema({
  password: String,
  username: String
})
const UsersDB = mongoose.model('users', usersSchema)

// ---------------------------------------------------------------------------

const Users = {
  createClient: createClient,
  createUser: createUser,
  getAccessToken: getAccessToken,
  getClient: getClient,
  getClients: getClients,
  getFirstClient: getFirstClient,
  getRefreshToken: getRefreshToken,
  getUser: getUser,
  getUsers: getUsers,
  saveToken: saveToken
}

function createClient (secret, grants, callback) {
  logger.debug('Creating client.')

  const mongoId = new mongoose.mongo.ObjectID()
  return OAuthClientsDB.create({ _id: mongoId, clientSecret: secret, grants: grants }, function (err) {
    if (err) return callback(err)

    return callback(null, mongoId)
  })
}

function createUser (username, password, callback) {
  logger.debug('Creating user.')

  return UsersDB.create({ username: username, password: password }, callback)
}

function getAccessToken (bearerToken, callback) {
  logger.debug('Getting access token (bearerToken: ' + bearerToken + ').')

  return OAuthTokensDB.findOne({ accessToken: bearerToken }).populate('user')
}

function getFirstClient (callback) {
  return OAuthClientsDB.findOne({}, callback)
}

function getClient (clientId, clientSecret) {
  logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + clientSecret + ').')

  // TODO req validator
  const mongoId = new mongoose.mongo.ObjectID(clientId)
  return OAuthClientsDB.findOne({ _id: mongoId, clientSecret: clientSecret })
}

function getClients (callback) {
  return OAuthClientsDB.find(callback)
}

function getRefreshToken (refreshToken) {
  logger.debug('Getting RefreshToken (refreshToken: ' + refreshToken + ').')

  return OAuthTokensDB.findOne({ refreshToken: refreshToken })
}

function getUser (username, password) {
  logger.debug('Getting User (username: ' + username + ', password: ' + password + ').')
  return UsersDB.findOne({ username: username, password: password })
}

function getUsers (callback) {
  return UsersDB.find(callback)
}

function saveToken (token, client, user) {
  logger.debug('Saving token for client ' + client.id + ' and user ' + user.id + '.')

  const tokenToCreate = {
    accessToken: token.accessToken,
    accessTokenExpiresOn: token.accessTokenExpiresOn,
    client: client.id,
    refreshToken: token.refreshToken,
    refreshTokenExpiresOn: token.refreshTokenExpiresOn,
    user: user.id
  }

  return OAuthTokensDB.create(tokenToCreate, function (err, tokenCreated) {
    if (err) throw err // node-oauth2-server library uses Promise.try

    tokenCreated.client = client
    tokenCreated.user = user

    return tokenCreated
  })
}

// ---------------------------------------------------------------------------

module.exports = Users
