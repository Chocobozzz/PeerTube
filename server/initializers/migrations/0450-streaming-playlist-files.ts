import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction,
  queryInterface: Sequelize.QueryInterface,
  sequelize: Sequelize.Sequelize,
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
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
