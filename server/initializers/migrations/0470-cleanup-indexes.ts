import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  await utils.sequelize.query('DROP INDEX IF EXISTS video_share_account_id;')
  await utils.sequelize.query('DROP INDEX IF EXISTS video_published_at;')

  await utils.sequelize.query('ALTER TABLE "avatar" DROP COLUMN IF EXISTS "avatarId"')
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
