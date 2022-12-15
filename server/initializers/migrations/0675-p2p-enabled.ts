import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  await utils.queryInterface.renameColumn('user', 'webTorrentEnabled', 'p2pEnabled')

  await utils.sequelize.query('ALTER TABLE "user" ALTER COLUMN "p2pEnabled" DROP DEFAULT')
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
