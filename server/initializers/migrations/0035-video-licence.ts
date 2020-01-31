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
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0
  } as Migration.Integer

  return q.addColumn('Videos', 'licence', data)
    .then(() => {
      data.defaultValue = null
      return q.changeColumn('Videos', 'licence', data)
    })
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
