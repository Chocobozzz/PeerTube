import { initDatabaseModels, sequelizeTypescript } from '@server/initializers/database.js'
import { ApplicationModel } from '@server/models/application/application.js'

const MIGRATION_NAME = 'peertube-8.3'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  await fillVideoSearchTable()
  await migrateVideoInfohashes()

  await ApplicationModel.setManualMigrationScriptRun(MIGRATION_NAME)
}

async function fillVideoSearchTable () {
  console.log('Filling videoSearch table with existing videos...')

  // video_search_vector() is created by the server on startup, so this builds the exact same vector as the trigger
  await sequelizeTypescript.query(`
    INSERT INTO "videoSearch" ("videoId", "searchVector")
    SELECT "id", video_search_vector(name, description)
    FROM "video"
    ON CONFLICT ("videoId") DO UPDATE SET
      "searchVector" = EXCLUDED."searchVector"
  `)

  console.log('videoSearch table filled.\n')
}

async function migrateVideoInfohashes () {
  const videoFileColumns = await sequelizeTypescript.getQueryInterface().describeTable('videoFile')
  if (!videoFileColumns['infoHash']) {
    console.log('Video infohashes already migrated, skipping.\n')
    return
  }

  console.log('Migrating video infohashes...')

  // Don't re-hydrate video streaming playlists infohash, PeerTube will re-generate them on the next startup

  // Classic infohash are stored as 40 char hex on the video file
  await sequelizeTypescript.query(`
    CREATE OR REPLACE FUNCTION safe_decode_hex(input text)
    RETURNS bytea AS $$
    BEGIN
      RETURN decode(input, 'hex');
    EXCEPTION
      WHEN others THEN
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql IMMUTABLE;
  `)

  await sequelizeTypescript.query(
    `INSERT INTO "videoInfohash" ("infohash", "videoFileId") ` +
      `SELECT safe_decode_hex("infoHash"), "id" FROM "videoFile" WHERE "infoHash" IS NOT NULL AND safe_decode_hex("infoHash") IS NOT NULL`
  )

  await sequelizeTypescript.query(`DROP FUNCTION safe_decode_hex(text);`)

  // Dropping a column also drops indexes that only depend on it (the old GIN index, and "videoFile"."infoHash")
  await sequelizeTypescript.query(`ALTER TABLE "videoStreamingPlaylist" DROP COLUMN IF EXISTS "p2pMediaLoaderInfohashes"`)
  await sequelizeTypescript.query(`ALTER TABLE "videoFile" DROP COLUMN IF EXISTS "infoHash"`)

  console.log('Video infohashes migrated.\n')
}
