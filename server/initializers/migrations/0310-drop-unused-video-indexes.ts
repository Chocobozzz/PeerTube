import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  const indexNames = [
    'video_category',
    'video_licence',
    'video_nsfw',
    'video_language',
    'video_wait_transcoding',
    'video_state',
    'video_remote',
    'video_likes'
  ]

  for (const indexName of indexNames) {
    await utils.sequelize.query('DROP INDEX IF EXISTS "' + indexName + '";')
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
