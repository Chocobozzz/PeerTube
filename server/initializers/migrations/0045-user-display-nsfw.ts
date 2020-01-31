import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

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
  }

  return q.addColumn('Users', 'displayNSFW', data)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
