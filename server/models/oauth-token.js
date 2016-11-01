const mongoose = require('mongoose')

const logger = require('../helpers/logger')

// ---------------------------------------------------------------------------

const OAuthTokenSchema = mongoose.Schema({
  accessToken: String,
  accessTokenExpiresAt: Date,
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'OAuthClient' },
  refreshToken: String,
  refreshTokenExpiresAt: Date,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
})

OAuthTokenSchema.path('accessToken').required(true)
OAuthTokenSchema.path('client').required(true)
OAuthTokenSchema.path('user').required(true)

OAuthTokenSchema.statics = {
  getByRefreshTokenAndPopulateClient,
  getByTokenAndPopulateUser,
  getByRefreshTokenAndPopulateUser,
  removeByUserId
}

mongoose.model('OAuthToken', OAuthTokenSchema)

// ---------------------------------------------------------------------------

function getByRefreshTokenAndPopulateClient (refreshToken) {
  return this.findOne({ refreshToken: refreshToken }).populate('client').exec().then(function (token) {
    if (!token) return token

    const tokenInfos = {
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      client: {
        id: token.client._id.toString()
      },
      user: token.user
    }

    return tokenInfos
  }).catch(function (err) {
    logger.info('getRefreshToken error.', { error: err })
  })
}

function getByTokenAndPopulateUser (bearerToken) {
  return this.findOne({ accessToken: bearerToken }).populate('user').exec()
}

function getByRefreshTokenAndPopulateUser (refreshToken) {
  return this.findOne({ refreshToken: refreshToken }).populate('user').exec()
}

function removeByUserId (userId, callback) {
  return this.remove({ user: userId }, callback)
}
