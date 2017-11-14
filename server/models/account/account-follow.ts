import { values } from 'lodash'
import * as Sequelize from 'sequelize'

import { addMethodsToModel } from '../utils'
import { AccountFollowAttributes, AccountFollowInstance, AccountFollowMethods } from './account-follow-interface'
import { FOLLOW_STATES } from '../../initializers/constants'

let AccountFollow: Sequelize.Model<AccountFollowInstance, AccountFollowAttributes>
let loadByAccountAndTarget: AccountFollowMethods.LoadByAccountAndTarget

export default function (sequelize: Sequelize.Sequelize, DataTypes: Sequelize.DataTypes) {
  AccountFollow = sequelize.define<AccountFollowInstance, AccountFollowAttributes>('AccountFollow',
    {
      state: {
        type: DataTypes.ENUM(values(FOLLOW_STATES)),
        allowNull: false
      }
    },
    {
      indexes: [
        {
          fields: [ 'accountId' ]
        },
        {
          fields: [ 'targetAccountId' ]
        },
        {
          fields: [ 'accountId', 'targetAccountId' ],
          unique: true
        }
      ]
    }
  )

  const classMethods = [
    associate,
    loadByAccountAndTarget
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
    as: 'accountFollowers',
    onDelete: 'CASCADE'
  })

  AccountFollow.belongsTo(models.Account, {
    foreignKey: {
      name: 'targetAccountId',
      allowNull: false
    },
    as: 'accountFollowing',
    onDelete: 'CASCADE'
  })
}

loadByAccountAndTarget = function (accountId: number, targetAccountId: number) {
  const query = {
    where: {
      accountId,
      targetAccountId
    }
  }

  return AccountFollow.findOne(query)
}
