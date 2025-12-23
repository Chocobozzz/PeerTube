import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    await utils.sequelize.query('DROP INDEX IF EXISTS "video_file_video_id"')
    await utils.sequelize.query('DROP INDEX IF EXISTS "video_file_video_streaming_playlist_id"')
  }

  {
    await utils.queryInterface.addColumn('videoFile', 'formatFlags', {
      type: Sequelize.INTEGER,
      defaultValue: 2, // fragmented
      allowNull: false
    }, { transaction })

    // Web videos will be updated in the migration script because the query can be slow

    await utils.queryInterface.changeColumn('videoFile', 'formatFlags', {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }, { transaction })
  }

  {
    await utils.queryInterface.addColumn('videoFile', 'streams', {
      type: Sequelize.INTEGER,
      defaultValue: 3, // audio + video
      allowNull: false
    }, { transaction })

    // Case where there is only an audio stream
    const query = 'UPDATE "videoFile" SET "streams" = 2 WHERE "resolution" = 0'
    await utils.sequelize.query(query, { transaction })

    await utils.queryInterface.changeColumn('videoFile', 'streams', {
      type: Sequelize.INTEGER,
      defaultValue: null,
      allowNull: false
    }, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down, up
}
