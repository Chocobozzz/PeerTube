import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<any> {
  await utils.sequelize.query('DROP INDEX IF EXISTS video_id_privacy_state_wait_transcoding;')
  await utils.sequelize.query('DROP INDEX IF EXISTS video_name;')

  for (let i = 0; i < 5; i++) {
    const query = 'DELETE FROM "videoFile" WHERE id IN ' +
      '(SELECT id FROM (SELECT MIN(id) AS id, "videoId", "resolution", "fps" ' +
      'FROM "videoFile" GROUP BY "videoId", "resolution", "fps" HAVING COUNT(*) > 1) t)'
    await utils.sequelize.query(query)
  }

  for (let i = 0; i < 5; i++) {
    const query = 'DELETE FROM "actor" WHERE id IN ' +
      '(SELECT id FROM (SELECT MIN(id) AS id, "uuid" ' +
      'FROM "actor" GROUP BY "uuid" HAVING COUNT(*) > 1) t)'
    await utils.sequelize.query(query)
  }

  for (let i = 0; i < 5; i++) {
    const query = 'DELETE FROM "account" WHERE id IN ' +
      '(SELECT id FROM (SELECT MIN(id) AS id, "actorId" ' +
      'FROM "account" GROUP BY "actorId" HAVING COUNT(*) > 1) t)'
    await utils.sequelize.query(query)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export { up, down }
