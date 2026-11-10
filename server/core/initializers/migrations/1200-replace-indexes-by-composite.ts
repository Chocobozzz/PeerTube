import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  await utils.sequelize.query(`DROP INDEX IF EXISTS "video_channel_id"`, { transaction })
  await utils.sequelize.query(`DROP INDEX IF EXISTS "video_comment_video_id"`, { transaction })
  await utils.sequelize.query(`DROP INDEX IF EXISTS "user_notification_user_id"`, { transaction })
  await utils.sequelize.query(`DROP INDEX IF EXISTS "video_playlist_element_video_playlist_id"`, { transaction })
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
