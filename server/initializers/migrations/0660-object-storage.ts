import * as Sequelize from 'sequelize'
import { VideoStorage } from '@shared/models'

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
      "pendingTranscoding" INTEGER NOT NULL,
      "videoId" serial UNIQUE NOT NULL REFERENCES "video" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "createdAt" timestamp WITH time zone NOT NULL,
      "updatedAt" timestamp WITH time zone NOT NULL,
      PRIMARY KEY ("id")
    );
    `

    await utils.sequelize.query(query)
  }

  {
    await utils.queryInterface.addColumn('videoFile', 'storage', { type: Sequelize.INTEGER, allowNull: true })
  }
  {
    await utils.sequelize.query(
      `UPDATE "videoFile" SET "storage" = ${VideoStorage.LOCAL}`
    )
  }
  {
    await utils.queryInterface.changeColumn('videoFile', 'storage', { type: Sequelize.INTEGER, allowNull: false })
  }

  {
    await utils.queryInterface.addColumn('videoStreamingPlaylist', 'storage', { type: Sequelize.INTEGER, allowNull: true })
  }
  {
    await utils.sequelize.query(
      `UPDATE "videoStreamingPlaylist" SET "storage" = ${VideoStorage.LOCAL}`
    )
  }
  {
    await utils.queryInterface.changeColumn('videoStreamingPlaylist', 'storage', { type: Sequelize.INTEGER, allowNull: false })
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  up,
  down
}
