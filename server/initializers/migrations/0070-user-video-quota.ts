import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'
import { Migration } from '../../models/migrations'

function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const q = utils.queryInterface

  const data = {
    type: Sequelize.BIGINT,
    allowNull: false,
    defaultValue: -1
  } as Migration.BigInteger

  return q.addColumn('Users', 'videoQuota', data)
    .then(() => {
      data.defaultValue = null
      return q.changeColumn('Users', 'videoQuota', data)
    })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
