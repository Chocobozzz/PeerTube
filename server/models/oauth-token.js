const logger = require('../helpers/logger')

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const OAuthToken = sequelize.define('OAuthToken',
    {
      accessToken: {
        type: DataTypes.STRING
      },
      accessTokenExpiresAt: {
        type: DataTypes.DATE
      },
      refreshToken: {
        type: DataTypes.STRING
      },
      refreshTokenExpiresAt: {
        type: DataTypes.DATE
      }
    },
    {
      classMethods: {
        associate,

        getByRefreshTokenAndPopulateClient,
        getByTokenAndPopulateUser,
        getByRefreshTokenAndPopulateUser,
        removeByUserId
      }
    }
  )

  return OAuthToken
}

// TODO: validation
// OAuthTokenSchema.path('accessToken').required(true)
// OAuthTokenSchema.path('client').required(true)
// OAuthTokenSchema.path('user').required(true)

// ---------------------------------------------------------------------------

function associate (models) {
  this.belongsTo(models.User, {
    foreignKey: {
      name: 'userId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
}

function getByRefreshTokenAndPopulateClient (refreshToken) {
  const query = {
    where: {
      refreshToken: refreshToken
    },
    include: [ this.associations.OAuthClient ]
  }

  return this.findOne(query).then(function (token) {
    if (!token) return token

    const tokenInfos = {
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      client: {
        id: token.client.id
      },
      user: {
        id: token.user
      }
    }

    return tokenInfos
  }).catch(function (err) {
    logger.info('getRefreshToken error.', { error: err })
  })
}

function getByTokenAndPopulateUser (bearerToken) {
  const query = {
    where: {
      accessToken: bearerToken
    },
    include: [ this.sequelize.models.User ]
  }

  return this.findOne(query).then(function (token) {
    if (token) token.user = token.User

    return token
  })
}

function getByRefreshTokenAndPopulateUser (refreshToken) {
  const query = {
    where: {
      refreshToken: refreshToken
    },
    include: [ this.sequelize.models.User ]
  }

  return this.findOne(query).then(function (token) {
    token.user = token.User

    return token
  })
}

function removeByUserId (userId, callback) {
  const query = {
    where: {
      userId: userId
    }
  }

  return this.destroy(query).asCallback(callback)
}
