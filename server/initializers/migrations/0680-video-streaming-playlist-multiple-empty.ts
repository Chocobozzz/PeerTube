import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    {
      await utils.queryInterface.removeIndex('videoStreamingPlaylist', 'video_streaming_playlist_video_id_type')
    }

    {
      await utils.queryInterface.addIndex('videoStreamingPlaylist', {
        unique: true,
        fields: [ 'videoId', 'playlistFilename', 'type' ]
      })
    }

    {
      const data = {
        type: Sequelize.STRING,
        allowNull: true
      }
      await utils.queryInterface.changeColumn('videoStreamingPlaylist', 'playlistFilename', data)
    }

    {
      const data = {
        type: Sequelize.INTEGER,
        allowNull: true
      }
      await utils.queryInterface.changeColumn('videoStreamingPlaylist', 'p2pMediaLoaderPeerVersion', data)
    }

    {
      const data = {
        type: Sequelize.STRING,
        allowNull: true
      }
      await utils.queryInterface.changeColumn('videoStreamingPlaylist', 'segmentsSha256Filename', data)
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
