/*
  Account rates per video.
*/
import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { VIDEO_RATE_TYPES } from '../../initializers'

import { addMethodsToModel } from '../utils'
import {
  AccountVideoRateInstance,
  AccountVideoRateAttributes,

  AccountVideoRateMethods
} from './account-video-rate-interface'

let AccountVideoRate: Sequelize.Model<AccountVideoRateInstance, AccountVideoRateAttributes>
let load: AccountVideoRateMethods.Load

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  AccountVideoRate = sequelize.define<AccountVideoRateInstance, AccountVideoRateAttributes>('AccountVideoRate',
    {
      type: {
        type: DataTypes.ENUM(values(VIDEO_RATE_TYPES)),
        allowNull: false
      }
    },
    {
      indexes: [
        {
          fields: [ 'videoId', 'accountId', 'type' ],
          unique: true
        }
      ]
    }
  )

  const classMethods = [
    associate,

    load
  ]
  addMethodsToModel(AccountVideoRate, classMethods)

  return AccountVideoRate
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  AccountVideoRate.belongsTo(models.Video, {
    foreignKey: {
      name: 'videoId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })

  AccountVideoRate.belongsTo(models.Account, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}

load = function (accountId: number, videoId: number, transaction: Sequelize.Transaction) {
  const options: Sequelize.FindOptions<AccountVideoRateAttributes> = {
    where: {
      accountId,
      videoId
    }
  }
  if (transaction) options.transaction = transaction

  return AccountVideoRate.findOne(options)
}
