/*
  User rates per video.
*/
import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { VIDEO_RATE_TYPES } from '../../initializers'

import { addMethodsToModel } from '../utils'
import {
  UserVideoRateInstance,
  UserVideoRateAttributes,

  UserVideoRateMethods
} from './user-video-rate-interface'

let UserVideoRate: Sequelize.Model<UserVideoRateInstance, UserVideoRateAttributes>
let load: UserVideoRateMethods.Load

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  UserVideoRate = sequelize.define<UserVideoRateInstance, UserVideoRateAttributes>('UserVideoRate',
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
      ]
    }
  )

  const classMethods = [
    associate,

    load
  ]
  addMethodsToModel(UserVideoRate, classMethods)

  return UserVideoRate
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  UserVideoRate.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })

  UserVideoRate.belongsTo(models.User, {
    foreignKey: {
      name: 'userId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

load = function (userId: number, videoId: number, transaction: Sequelize.Transaction) {
  const options: Sequelize.FindOptions = {
    where: {
      userId,
      videoId
    }
  }
  if (transaction) options.transaction = transaction

  return UserVideoRate.findOne(options)
}
