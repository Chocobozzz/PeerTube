/* eslint-disable max-len */
import { InvalidArgumentError, createCommand } from '@commander-js/extra-typings'
import { FileStorage } from '@peertube/peertube-models'
import { escapeForRegex } from '@server/helpers/regexp.js'
import { initDatabaseModels, sequelizeTypescript } from '@server/initializers/database.js'
import { QueryTypes } from 'sequelize'
import { askConfirmation, displayPeerTubeMustBeStoppedWarning } from './shared/common.js'

const program = createCommand()
  .description('Update PeerTube object file URLs after an object storage migration.')
  .requiredOption('-f, --from <url>', 'Previous object storage base URL', parseUrl)
  .requiredOption('-t, --to <url>', 'New object storage base URL', parseUrl)
  .parse(process.argv)

const options = program.opts()

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  displayPeerTubeMustBeStoppedWarning()

  const fromRegexp = `^${escapeForRegex(options.from)}`
  const to = options.to

  const replacements = { fromRegexp, to, storage: FileStorage.OBJECT_STORAGE }

  // Candidates
  {
    const queries = [
      `SELECT COUNT(*) AS "c", 'videoFile->fileUrl: ' || COUNT(*) AS "t" FROM "videoFile" WHERE "fileUrl" ~ :fromRegexp AND "storage" = :storage`,
      `SELECT COUNT(*) AS "c", 'videoStreamingPlaylist->playlistUrl: ' || COUNT(*) AS "t" FROM "videoStreamingPlaylist" WHERE "playlistUrl" ~ :fromRegexp AND "storage" = :storage`,
      `SELECT COUNT(*) AS "c", 'videoStreamingPlaylist->segmentsSha256Url: ' || COUNT(*) AS "t" FROM "videoStreamingPlaylist" WHERE "segmentsSha256Url" ~ :fromRegexp AND "storage" = :storage`,
      `SELECT COUNT(*) AS "c", 'userExport->fileUrl: ' || COUNT(*) AS "t" FROM "userExport" WHERE "fileUrl" ~ :fromRegexp AND "storage" = :storage`,
      `SELECT COUNT(*) AS "c", 'videoSource->fileUrl: ' || COUNT(*) AS "t" FROM "videoSource" WHERE "fileUrl" ~ :fromRegexp AND "storage" = :storage`,
      `SELECT COUNT(*) AS "c", 'videoCaption->fileUrl: ' || COUNT(*) AS "t" FROM "videoCaption" WHERE "fileUrl" ~ :fromRegexp AND "storage" = :storage`
    ]

    let hasResults = false

    console.log('Candidate URLs to update:')
    for (const query of queries) {
      const [ row ] = await sequelizeTypescript.query(query, { replacements, type: QueryTypes.SELECT as QueryTypes.SELECT })

      if (row['c'] !== 0) hasResults = true

      console.log(` ${row['t']}`)
    }

    console.log('\n')

    if (!hasResults) {
      console.log('No candidate URLs found, exiting.')
      process.exit(0)
    }
  }

  const res = await askUpdateConfirmation()
  if (res !== true) {
    console.log('Exiting without updating URLs.')
    process.exit(0)
  }

  // Execute
  {
    const queries = [
      `UPDATE "videoFile" SET "fileUrl" = regexp_replace("fileUrl", :fromRegexp, :to) WHERE "storage" = :storage`,
      `UPDATE "videoStreamingPlaylist" SET "playlistUrl" = regexp_replace("playlistUrl", :fromRegexp, :to) WHERE "storage" = :storage`,
      `UPDATE "videoStreamingPlaylist" SET "segmentsSha256Url" = regexp_replace("segmentsSha256Url", :fromRegexp, :to) WHERE "storage" = :storage`,
      `UPDATE "userExport" SET "fileUrl" = regexp_replace("fileUrl", :fromRegexp, :to) WHERE "storage" = :storage`,
      `UPDATE "videoSource" SET "fileUrl" = regexp_replace("fileUrl", :fromRegexp, :to) WHERE "storage" = :storage`,
      `UPDATE "videoCaption" SET "fileUrl" = regexp_replace("fileUrl", :fromRegexp, :to) WHERE "storage" = :storage`
    ]

    for (const query of queries) {
      await sequelizeTypescript.query(query, { replacements })
    }

    console.log('URLs updated.')
  }
}

function parseUrl (value: string) {
  if (!value || /^https?:\/\//.test(value) !== true) {
    throw new InvalidArgumentError('Must be a valid URL (starting with http:// or https://).')
  }

  return value
}

async function askUpdateConfirmation () {
  return askConfirmation(
    'These URLs can be updated, but please check your backups first (bugs happen). ' +
    'Can we update these URLs?'
  )
}
