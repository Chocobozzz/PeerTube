import * as Sequelize from 'sequelize'
import { FileStorage } from '@peertube/peertube-models'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
  db: any
}): Promise<void> {
  {
    const query = `
    CREATE TABLE IF NOT EXISTS "videoJobInfo" (
      "id" serial,
      "pendingMove" INTEGER NOT NULL,
      "pendingTranscode" INTEGER NOT NULL,
      "videoId" serial UNIQUE NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "createdAt" timestamp WITH time zone NOT NULL,
      "updatedAt" timestamp WITH time zone NOT NULL,
      PRIMARY KEY ("id")
    );
    `

    await utils.sequelize.query(query)
  }

  {
    await utils.queryInterface.addColumn('videoFile', 'storage', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: FileStorage.FILE_SYSTEM
    })
    await utils.queryInterface.changeColumn('videoFile', 'storage', { type: Sequelize.INTEGER, allowNull: false, defaultValue: null })
  }

  {
    await utils.queryInterface.addColumn('videoStreamingPlaylist', 'storage', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: FileStorage.FILE_SYSTEM
    })
    await utils.queryInterface.changeColumn('videoStreamingPlaylist', 'storage', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: null
    })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
