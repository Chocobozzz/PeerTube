const mongoose = require('mongoose')

// ---------------------------------------------------------------------------

const OAuthTokenSchema = mongoose.Schema({
  accessToken: String,
  accessTokenExpiresOn: Date,
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'OAuthClient' },
  refreshToken: String,
  refreshTokenExpiresOn: Date,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
})

OAuthTokenSchema.path('accessToken').required(true)
OAuthTokenSchema.path('client').required(true)
OAuthTokenSchema.path('user').required(true)

OAuthTokenSchema.statics = {
  loadByRefreshToken: loadByRefreshToken,
  loadByTokenAndPopulateUser: loadByTokenAndPopulateUser
}

mongoose.model('OAuthToken', OAuthTokenSchema)

// ---------------------------------------------------------------------------

function loadByRefreshToken (refreshToken, callback) {
  return this.findOne({ refreshToken: refreshToken }, callback)
}

function loadByTokenAndPopulateUser (bearerToken, callback) {
  // FIXME: allow to use callback
  return this.findOne({ accessToken: bearerToken }).populate('user')
}
