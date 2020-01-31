import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  await utils.queryInterface.dropTable('job')
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
