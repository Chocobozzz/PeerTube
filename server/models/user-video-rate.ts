/*
  User rates per video.

*/
import { values } from 'lodash'

import { VIDEO_RATE_TYPES } from '../initializers'

// ---------------------------------------------------------------------------

module.exports = function (sequelize, DataTypes) {
  const UserVideoRate = sequelize.define('UserVideoRate',
    {
      type: {
        type: DataTypes.ENUM(values(VIDEO_RATE_TYPES)),
        allowNull: false
      }
    },
    {
      indexes: [
        {
          fields: [ 'videoId', 'userId', 'type' ],
          unique: true
        }
      ],
      classMethods: {
        associate,

        load
      }
    }
  )

  return UserVideoRate
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  this.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })

  this.belongsTo(models.User, {
    foreignKey: {
      name: 'userId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

function load (userId, videoId, transaction, callback) {
  if (!callback) {
    callback = transaction
    transaction = null
  }

  const query = {
    where: {
      userId,
      videoId
    }
  }

  const options: any = {}
  if (transaction) options.transaction = transaction

  return this.findOne(query, options).asCallback(callback)
}
