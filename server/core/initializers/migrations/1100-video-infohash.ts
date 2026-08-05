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

  // Don't re-hydrate video streaming playlists infohash, PeerTube will re-generate them on the next startup

  // Classic infohash are stored as 40 char hex on the video file
  {
    await utils.sequelize.query(
      `CREATE OR REPLACE FUNCTION safe_decode_hex(input text)
RETURNS bytea AS $$
BEGIN
  RETURN decode(input, 'hex');
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;`,
      { transaction }
    )

    await utils.sequelize.query(
      `INSERT INTO "videoInfohash" ("infohash", "videoFileId") ` +
        `SELECT safe_decode_hex("infoHash"), "id" FROM "videoFile" WHERE "infoHash" IS NOT NULL AND safe_decode_hex("infoHash") IS NOT NULL`,
      { transaction }
    )

    await utils.sequelize.query(`DROP FUNCTION safe_decode_hex(text);`, { transaction })
  }

  // Dropping a column also drops indexes that only depend on it (the old GIN index, and "videoFile"."infoHash")
  {
    await utils.sequelize.query(
      `ALTER TABLE "videoStreamingPlaylist" DROP COLUMN "p2pMediaLoaderInfohashes"`,
      { transaction }
    )
  }

  {
    await utils.sequelize.query(
      `ALTER TABLE "videoFile" DROP COLUMN "infoHash"`,
      { transaction }
    )
  }
}

function down () {
  throw new Error('Not implemented.')
}

export {
  down,
  up
}
