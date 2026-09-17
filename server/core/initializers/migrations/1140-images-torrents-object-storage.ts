import { FileStorage } from '@peertube/peertube-models'
import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  for (const table of [ 'actorImage', 'thumbnail', 'storyboard', 'uploadImage' ]) {
    await utils.queryInterface.addColumn(table, 'storage', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: FileStorage.FILE_SYSTEM
    }, { transaction })

    await utils.queryInterface.changeColumn(table, 'storage', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    }, { transaction })
  }

  {
    await utils.queryInterface.addColumn('videoFile', 'torrentStorage', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: FileStorage.FILE_SYSTEM
    }, { transaction })

    await utils.sequelize.query(
      'UPDATE "videoFile" SET "torrentStorage" = NULL WHERE "torrentFilename" IS NULL',
      { transaction }
    )

    await utils.queryInterface.changeColumn('videoFile', 'torrentStorage', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    }, { transaction })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
