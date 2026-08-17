import * as Sequelize from 'sequelize'

async function up (utils: {
  transaction: Sequelize.Transaction
  queryInterface: Sequelize.QueryInterface
  sequelize: Sequelize.Sequelize
}): Promise<void> {
  const { transaction } = utils

  {
    const query = `
CREATE TABLE IF NOT EXISTS "videoInfohash" (
  "id" SERIAL,
  "infohash" BYTEA NOT NULL,
  "videoStreamingPlaylistId" INTEGER REFERENCES "videoStreamingPlaylist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "videoFileId" INTEGER REFERENCES "videoFile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("id")
);`

    await utils.sequelize.query(query, { transaction })
  }

  // Backfilling "videoInfohash" from the old columns, and dropping these columns,
  // is done in server/scripts/migrations/peertube-8.3.ts because it can take a while on big instances
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
