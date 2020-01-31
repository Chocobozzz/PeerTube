import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  try {
    await utils.queryInterface.removeColumn('application', 'createdAt')
  } catch { /* the column could not exist */ }

  try {
    await utils.queryInterface.removeColumn('application', 'updatedAt')
  } catch { /* the column could not exist */ }

  try {
    await utils.queryInterface.removeColumn('videoView', 'updatedAt')
  } catch { /* the column could not exist */ }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
