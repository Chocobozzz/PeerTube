import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  {
    await utils.sequelize.query(
      `CREATE TABLE IF NOT EXISTS "videoChannelActivity" (
  "id" SERIAL,
  "action" INTEGER NOT NULL,
  "targetType" INTEGER NOT NULL,
  "data" JSONB NOT NULL,
  "details" JSONB,
  "videoChannelId" INTEGER NOT NULL REFERENCES "videoChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accountId" INTEGER REFERENCES "account" ("id") ON DELETE
  SET
    NULL ON UPDATE CASCADE,
    "videoId" INTEGER REFERENCES "video" ("id") ON DELETE
  SET
    NULL ON UPDATE CASCADE,
    "videoPlaylistId" INTEGER REFERENCES "videoPlaylist" ("id") ON DELETE
  SET
    NULL ON UPDATE CASCADE,
    "videoChannelSyncId" INTEGER REFERENCES "videoChannelSync" ("id") ON DELETE
  SET
    NULL ON UPDATE CASCADE,
    "videoImportId" INTEGER REFERENCES "videoImport" ("id") ON DELETE
  SET
    NULL ON UPDATE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY ("id")
);`,
      { transaction: utils.transaction }
    )
  }
}

function down (options) {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
