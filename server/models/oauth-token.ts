import { logger } from '../helpers'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const OAuthToken = sequelize.define('OAuthToken',
    {
      accessToken: {
        type: DataTypes.STRING,
        allowNull: false
      },
      accessTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      refreshToken: {
        type: DataTypes.STRING,
        allowNull: false
      },
      refreshTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    },
    {
      indexes: [
        {
          fields: [ 'refreshToken' ],
          unique: true
        },
        {
          fields: [ 'accessToken' ],
          unique: true
        },
        {
          fields: [ 'userId' ]
        },
        {
          fields: [ 'oAuthClientId' ]
        }
      ],
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

// ---------------------------------------------------------------------------

function associate (models) {
  this.belongsTo(models.User, {
    foreignKey: {
      name: 'userId',
      allowNull: false
    },
    onDelete: 'cascade'
  })

  this.belongsTo(models.OAuthClient, {
    foreignKey: {
      name: 'oAuthClientId',
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
