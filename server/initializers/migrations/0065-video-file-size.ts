import * as Sequelize from 'sequelize'

function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  throw new Error('Removed, please upgrade from a previous version first.')
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
