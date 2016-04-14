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
  getRefreshToken: getRefreshToken,
  getUser: getUser,
  getUsers: getUsers,
  saveToken: saveToken
}

function createClient (secret, grants, callback) {
  logger.debug('Creating client.')

  const mongo_id = new mongoose.mongo.ObjectID()
  return OAuthClientsDB.create({ _id: mongo_id, clientSecret: secret, grants: grants }, function (err) {
    if (err) return callback(err)

    return callback(null, mongo_id)
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

function getClient (clientId, clientSecret) {
  logger.debug('Getting Client (clientId: ' + clientId + ', clientSecret: ' + clientSecret + ').')

  // TODO req validator
  const mongo_id = new mongoose.mongo.ObjectID(clientId)
  return OAuthClientsDB.findOne({ _id: mongo_id, clientSecret: clientSecret })
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

  const token_to_create = {
    accessToken: token.accessToken,
    accessTokenExpiresOn: token.accessTokenExpiresOn,
    client: client.id,
    refreshToken: token.refreshToken,
    refreshTokenExpiresOn: token.refreshTokenExpiresOn,
    user: user.id
  }

  return OAuthTokensDB.create(token_to_create, function (err, token_created) {
    if (err) throw err // node-oauth2-server library uses Promise.try

    token_created.client = client
    token_created.user = user

    return token_created
  })
}

// ---------------------------------------------------------------------------

module.exports = Users
