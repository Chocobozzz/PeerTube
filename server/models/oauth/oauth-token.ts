import * as Sequelize from 'sequelize'

import { logger } from '../../helpers'

import { addMethodsToModel } from '../utils'
import {
  OAuthTokenInstance,
  OAuthTokenAttributes,

  OAuthTokenMethods,
  OAuthTokenInfo
} from './oauth-token-interface'

let OAuthToken: Sequelize.Model<OAuthTokenInstance, OAuthTokenAttributes>
let getByRefreshTokenAndPopulateClient: OAuthTokenMethods.GetByRefreshTokenAndPopulateClient
let getByTokenAndPopulateUser: OAuthTokenMethods.GetByTokenAndPopulateUser
let getByRefreshTokenAndPopulateUser: OAuthTokenMethods.GetByRefreshTokenAndPopulateUser
let removeByUserId: OAuthTokenMethods.RemoveByUserId

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  OAuthToken = sequelize.define<OAuthTokenInstance, OAuthTokenAttributes>('OAuthToken',
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

getByRefreshTokenAndPopulateClient = function (refreshToken: string) {
  const query = {
    where: {
      refreshToken: refreshToken
    },
    include: [ OAuthToken['sequelize'].models.OAuthClient ]
  }

  return OAuthToken.findOne(query)
    .then(token => {
      if (!token) return null

      const tokenInfos: OAuthTokenInfo = {
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        client: {
          id: token.oAuthClientId
        },
        user: {
          id: token.userId
        }
      }

      return tokenInfos
    })
    .catch(err => {
      logger.info('getRefreshToken error.', err)
      throw err
    })
}

getByTokenAndPopulateUser = function (bearerToken: string) {
  const query = {
    where: {
      accessToken: bearerToken
    },
    include: [ OAuthToken['sequelize'].models.User ]
  }

  return OAuthToken.findOne(query).then(token => {
    if (token) token['user'] = token.User

    return token
  })
}

getByRefreshTokenAndPopulateUser = function (refreshToken: string) {
  const query = {
    where: {
      refreshToken: refreshToken
    },
    include: [ OAuthToken['sequelize'].models.User ]
  }

  return OAuthToken.findOne(query).then(token => {
    token['user'] = token.User

    return token
  })
}

removeByUserId = function (userId: number) {
  const query = {
    where: {
      userId: userId
    }
  }

  return OAuthToken.destroy(query)
}
