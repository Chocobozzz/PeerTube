import * as Sequelize from 'sequelize'

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
  }

  return q.addColumn('Videos', 'views', data)
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
