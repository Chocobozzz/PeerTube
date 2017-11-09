import * as Sequelize from 'sequelize'

import { addMethodsToModel } from '../utils'
import {
  AccountFollowInstance,
  AccountFollowAttributes,

  AccountFollowMethods
} from './account-follow-interface'

let AccountFollow: Sequelize.Model<AccountFollowInstance, AccountFollowAttributes>

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  AccountFollow = sequelize.define<AccountFollowInstance, AccountFollowAttributes>('AccountFollow',
    { },
    {
      indexes: [
        {
          fields: [ 'accountId' ],
          unique: true
        },
        {
          fields: [ 'targetAccountId' ],
          unique: true
        }
      ]
    }
  )

  const classMethods = [
    associate
  ]
  addMethodsToModel(AccountFollow, classMethods)

  return AccountFollow
}

// ------------------------------ STATICS ------------------------------

function associate (models) {
  AccountFollow.belongsTo(models.Account, {
    foreignKey: {
      name: 'accountId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })

  AccountFollow.belongsTo(models.Account, {
    foreignKey: {
      name: 'targetAccountId',
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
}
