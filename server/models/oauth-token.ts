import * as Sequelize from 'sequelize'

import { logger } from '../helpers'

import { addMethodsToModel } from './utils'
import {
  OAuthTokenClass,
  OAuthTokenInstance,
  OAuthTokenAttributes,

  OAuthTokenMethods
} from './oauth-token-interface'

let OAuthToken: Sequelize.Model<OAuthTokenInstance, OAuthTokenAttributes>
let getByRefreshTokenAndPopulateClient: OAuthTokenMethods.GetByRefreshTokenAndPopulateClient
let getByTokenAndPopulateUser: OAuthTokenMethods.GetByTokenAndPopulateUser
let getByRefreshTokenAndPopulateUser: OAuthTokenMethods.GetByRefreshTokenAndPopulateUser
let removeByUserId: OAuthTokenMethods.RemoveByUserId

export default function (sequelize, DataTypes) {
  OAuthToken = sequelize.define('OAuthToken',
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
      ]
    }
  )

  const classMethods = [
    associate,

    getByRefreshTokenAndPopulateClient,
    getByTokenAndPopulateUser,
    getByRefreshTokenAndPopulateUser,
    removeByUserId
  ]
  addMethodsToModel(OAuthToken, classMethods)

  return OAuthToken
}

// ---------------------------------------------------------------------------

function associate (models) {
  OAuthToken.belongsTo(models.User, {
    foreignKey: {
      name: 'userId',
      allowNull: false
    },
    onDelete: 'cascade'
  })

  OAuthToken.belongsTo(models.OAuthClient, {
    foreignKey: {
      name: 'oAuthClientId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
}

getByRefreshTokenAndPopulateClient = function (refreshToken) {
  const query = {
    where: {
      refreshToken: refreshToken
    },
    include: [ OAuthToken['sequelize'].models.OAuthClient ]
  }

  return OAuthToken.findOne(query).then(function (token) {
    if (!token) return token

    const tokenInfos = {
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      client: {
        id: token['client'].id
      },
      user: {
        id: token['user']
      }
    }

    return tokenInfos
  }).catch(function (err) {
    logger.info('getRefreshToken error.', { error: err })
  })
}

getByTokenAndPopulateUser = function (bearerToken) {
  const query = {
    where: {
      accessToken: bearerToken
    },
    include: [ OAuthToken['sequelize'].models.User ]
  }

  return OAuthToken.findOne(query).then(function (token) {
    if (token) token['user'] = token.User

    return token
  })
}

getByRefreshTokenAndPopulateUser = function (refreshToken) {
  const query = {
    where: {
      refreshToken: refreshToken
    },
    include: [ OAuthToken['sequelize'].models.User ]
  }

  return OAuthToken.findOne(query).then(function (token) {
    token['user'] = token.User

    return token
  })
}

removeByUserId = function (userId, callback) {
  const query = {
    where: {
      userId: userId
    }
  }

  return OAuthToken.destroy(query).asCallback(callback)
}
