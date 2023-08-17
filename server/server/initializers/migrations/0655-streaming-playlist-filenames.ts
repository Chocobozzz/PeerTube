import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    for (const column of [ 'playlistUrl', 'segmentsSha256Url' ]) {
      const data = {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      }

      await utils.queryInterface.changeColumn('videoStreamingPlaylist', column, data)
    }
  }

  {
    await utils.sequelize.query(
      `UPDATE "videoStreamingPlaylist" SET "playlistUrl" = NULL, "segmentsSha256Url" = NULL ` +
      `WHERE "videoId" IN (SELECT id FROM video WHERE remote IS FALSE)`
    )
  }

  {
    for (const column of [ 'playlistFilename', 'segmentsSha256Filename' ]) {
      const data = {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      }

      await utils.queryInterface.addColumn('videoStreamingPlaylist', column, data)
    }
  }

  {
    await utils.sequelize.query(
      `UPDATE "videoStreamingPlaylist" SET "playlistFilename" = 'master.m3u8', "segmentsSha256Filename" = 'segments-sha256.json'`
    )
  }

  {
    for (const column of [ 'playlistFilename', 'segmentsSha256Filename' ]) {
      const data = {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: null
      }

      await utils.queryInterface.changeColumn('videoStreamingPlaylist', column, data)
    }
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
