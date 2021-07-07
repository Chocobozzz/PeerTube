import * as Sequelize from 'sequelize'

function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const q = utils.queryInterface

  const data = {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }

  return q.addColumn('user', 'autoPlayVideo', data)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
