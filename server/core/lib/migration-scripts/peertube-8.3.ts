import { wait } from '@peertube/peertube-core-utils'
import { runTransaction } from '@server/helpers/database-utils.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { QueryTypes } from 'sequelize'
import { MigrationScriptLogger } from './shared.js'

// The script runs while PeerTube serves requests: process rows in chunks to not hold locks for too long
const CHUNK_SIZE = 1000

export async function runPeerTube83MigrationScript (logger: MigrationScriptLogger) {
  await fillVideoSearchTable(logger)
  await migrateVideoInfohashes(logger)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function fillVideoSearchTable (logger: MigrationScriptLogger) {
  logger.info('Filling videoSearch table with existing videos...')

  // video_search_vector() is created by the server on startup, so this builds the exact same vector as the trigger
  const total = await processInChunks({
    table: 'video',
    columns: [ 'name', 'description' ],
    buildQuery: batch =>
      `INSERT INTO "videoSearch" ("videoId", "searchVector") ` +
      `SELECT "b"."id", video_search_vector("b"."name", "b"."description") FROM ${batch} "b" ` +
      `WHERE NOT EXISTS (SELECT 1 FROM "videoSearch" "vs" WHERE "vs"."videoId" = "b"."id") ` +
      `ON CONFLICT ("videoId") DO NOTHING`
  })

  logger.info(`videoSearch table filled (${total} videos processed).`)
}

async function migrateVideoInfohashes (logger: MigrationScriptLogger) {
  const videoFileColumns = await sequelizeTypescript.getQueryInterface().describeTable('videoFile')
  if (!videoFileColumns['infoHash']) {
    logger.info('Video infohashes already migrated, skipping.')
    return
  }

  logger.info('Migrating video infohashes...')

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

  const total = await processInChunks({
    table: 'videoFile',
    columns: [ 'infoHash' ],
    buildQuery: batch =>
      `INSERT INTO "videoInfohash" ("infohash", "videoFileId") ` +
      `SELECT safe_decode_hex("b"."infoHash"), "b"."id" FROM ${batch} "b" ` +
      `WHERE "b"."infoHash" IS NOT NULL ` +
      `AND NOT EXISTS (SELECT 1 FROM "videoInfohash" "vi" WHERE "vi"."videoFileId" = "b"."id") ` +
      `AND safe_decode_hex("b"."infoHash") IS NOT NULL ` +
      `ON CONFLICT DO NOTHING`
  })

  await sequelizeTypescript.query(`DROP FUNCTION IF EXISTS safe_decode_hex(text);`)

  // Dropping a column also drops indexes that only depend on it (the old GIN index, and "videoFile"."infoHash")
  await dropColumnWithRetries({ table: 'videoStreamingPlaylist', column: 'p2pMediaLoaderInfohashes', logger })
  await dropColumnWithRetries({ table: 'videoFile', column: 'infoHash', logger })

  logger.info(`Video infohashes migrated (${total} video files processed).`)
}

// ---------------------------------------------------------------------------

/**
 * Run the write query built by `buildQuery` on rows of `table`, in chunks ordered by id
 * `buildQuery` receives the name of the CTE containing the `id` and `columns` of the rows of the chunk
 */
async function processInChunks (options: {
  table: string
  columns: string[]
  buildQuery: (batch: string) => string
}) {
  const { table, columns, buildQuery } = options

  const select = [ 'id', ...columns ].map(c => `"${c}"`).join(', ')

  let lastId = 0
  let total = 0

  while (true) {
    // Not a QueryTypes.SELECT, so it is never sent to a read replica
    const [ rows ] = await sequelizeTypescript.query(
      `WITH "batch" AS (SELECT ${select} FROM "${table}" WHERE "id" > :lastId ORDER BY "id" ASC LIMIT :limit), ` +
        `"written" AS (${buildQuery('"batch"')}) ` +
        `SELECT MAX("id") AS "lastId", COUNT(*) AS "count" FROM "batch"`,
      { type: QueryTypes.RAW, replacements: { lastId, limit: CHUNK_SIZE } }
    ) as [{ lastId: number, count: string }[], unknown]

    const count = parseInt(rows[0].count, 10)
    total += count

    if (count < CHUNK_SIZE) return total

    lastId = rows[0].lastId
  }
}

/**
 * Dropping a column needs an exclusive lock on the table, and requests of the running server queue behind the waiting ALTER
 * So use a short lock timeout and retry a few times, instead of blocking the table for a long time
 * If the lock still cannot be acquired, the script fails and will be run again later
 */
async function dropColumnWithRetries (options: {
  table: string
  column: string
  logger: MigrationScriptLogger
}) {
  const { table, column, logger } = options

  const maxAttempts = 10

  for (let attempt = 1;; attempt++) {
    try {
      await runTransaction(async transaction => {
        await sequelizeTypescript.query(`SET LOCAL lock_timeout = '1s'`, { transaction })
        await sequelizeTypescript.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}"`, { transaction })
      })

      return
    } catch (err) {
      // 55P03: lock_not_available
      if (err?.parent?.code !== '55P03' || attempt === maxAttempts) throw err

      logger.info(`Cannot lock ${table} table to drop the ${column} column (attempt ${attempt}/${maxAttempts}), retrying...`)
      await wait(5000)
    }
  }
}
