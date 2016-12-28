'use strict'

module.exports = function (sequelize, DataTypes) {
  const OAuthClient = sequelize.define('OAuthClient',
    {
      clientId: {
        type: DataTypes.STRING,
        allowNull: false
      },
      clientSecret: {
        type: DataTypes.STRING,
        allowNull: false
      },
      grants: {
        type: DataTypes.ARRAY(DataTypes.STRING)
      },
      redirectUris: {
        type: DataTypes.ARRAY(DataTypes.STRING)
      }
    },
    {
      classMethods: {
        associate,

        getByIdAndSecret,
        list,
        loadFirstClient
      }
    }
  )

  return OAuthClient
}

// ---------------------------------------------------------------------------

function associate (models) {
  this.hasMany(models.OAuthToken, {
    foreignKey: {
      name: 'oAuthClientId',
      allowNull: false
    },
    onDelete: 'cascade'
  })
}

function list (callback) {
  return this.findAll().asCallback(callback)
}

function loadFirstClient (callback) {
  return this.findOne().asCallback(callback)
}

function getByIdAndSecret (clientId, clientSecret) {
  const query = {
    where: {
      clientId: clientId,
      clientSecret: clientSecret
    }
  }

  return this.findOne(query)
}
