import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'
import { Migration } from '../../models/migrations'

function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const q = utils.queryInterface

  const data = {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false
  } as Migration.Boolean

  return q.addColumn('Videos', 'nsfw', data)
    .then(() => {
      data.defaultValue = null

      return q.changeColumn('Videos', 'nsfw', data)
    })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
