import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {

  await utils.sequelize.query('DROP INDEX IF EXISTS video_views;')
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
