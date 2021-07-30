import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    await utils.queryInterface.addColumn('video', 'transcodeJobsRunning', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 })
  }

  {
    await utils.queryInterface.addColumn('videoFile', 'storage', { type: Sequelize.INTEGER, allowNull: false })
  }

  {
    await utils.sequelize.query(
      `UPDATE "videoFile" SET "storage" = 'local'`
    )
  }

  {
    await utils.queryInterface.addColumn('videoStreamingPlaylist', 'storage', { type: Sequelize.INTEGER, allowNull: false })
  }

  {
    await utils.sequelize.query(
      `UPDATE "videoStreamingPlaylist" SET "storage" = 'local'`
    )
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
