import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'videoStreamingPlaylist',
        key: 'id'
      },
      onDelete: 'CASCADE'
    }

    await utils.queryInterface.addColumn('videoFile', 'videoStreamingPlaylistId', data)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: true
    }

    await utils.queryInterface.changeColumn('videoFile', 'videoId', data)
  }

  {
    await utils.queryInterface.removeIndex('videoFile', 'video_file_video_id_resolution_fps')
  }

  {
    const query = 'insert into "videoFile" ' +
      '(resolution, size, "infoHash", "videoId", "createdAt", "updatedAt", fps, extname, "videoStreamingPlaylistId")' +
      '(SELECT "videoFile".resolution, "videoFile".size, \'fake\', NULL, "videoFile"."createdAt", "videoFile"."updatedAt", ' +
      '"videoFile"."fps", "videoFile".extname, "videoStreamingPlaylist".id FROM "videoStreamingPlaylist" ' +
      'inner join video ON video.id = "videoStreamingPlaylist"."videoId" inner join "videoFile" ON "videoFile"."videoId" = video.id)'

    await utils.sequelize.query(query, { transaction: utils.transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
