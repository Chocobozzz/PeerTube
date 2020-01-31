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
      defaultValue: null
    }
    await utils.queryInterface.addColumn('videoStreamingPlaylist', 'p2pMediaLoaderPeerVersion', data)
  }

  {
    const query = `UPDATE "videoStreamingPlaylist" SET "p2pMediaLoaderPeerVersion" = 0;`
    await utils.sequelize.query(query)
  }

  {
    const data = {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    }
    await utils.queryInterface.changeColumn('videoStreamingPlaylist', 'p2pMediaLoaderPeerVersion', data)
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
