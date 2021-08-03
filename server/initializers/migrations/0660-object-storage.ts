import { VideoStorageType } from '@server/types/models'
import * as Sequelize from 'sequelize'

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
      "videoUUID" uuid UNIQUE NOT NULL REFERENCES "video" ("uuid") ON DELETE CASCADE ON UPDATE CASCADE,
      "createdAt" timestamp WITH time zone NOT NULL,
      "updatedAt" timestamp WITH time zone NOT NULL,
      PRIMARY KEY ("id")
    );
    `

    await utils.sequelize.query(query)
  }

  {
    await utils.queryInterface.addColumn('videoFile', 'storage', { type: Sequelize.INTEGER, allowNull: false })
  }

  {
    await utils.sequelize.query(
      `UPDATE "videoFile" SET "storage" = ${VideoStorageType.LOCAL}`
    )
  }

  {
    await utils.queryInterface.addColumn('videoStreamingPlaylist', 'storage', { type: Sequelize.INTEGER, allowNull: false })
  }

  {
    await utils.sequelize.query(
      `UPDATE "videoStreamingPlaylist" SET "storage" = ${VideoStorageType.LOCAL}`
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
