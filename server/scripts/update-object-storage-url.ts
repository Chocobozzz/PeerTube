/* eslint-disable max-len */
import { InvalidArgumentError, createCommand } from '@commander-js/extra-typings'
import { FileStorage } from '@peertube/peertube-models'
import { escapeForRegex } from '@server/helpers/regexp.js'
import { initDatabaseModels, sequelizeTypescript } from '@server/initializers/database.js'
import { QueryTypes } from 'sequelize'
import prompt from 'prompt'

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
      `SELECT COUNT(*) AS "c", 'videoSource->fileUrl: ' || COUNT(*) AS "t" FROM "videoSource" WHERE "fileUrl" ~ :fromRegexp AND "storage" = :storage`
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

  const res = await askConfirmation()
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
      `UPDATE "videoSource" SET "fileUrl" = regexp_replace("fileUrl", :fromRegexp, :to) WHERE "storage" = :storage`
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

async function askConfirmation () {
  return new Promise((res, rej) => {
    prompt.start()

    const schema = {
      properties: {
        confirm: {
          type: 'string',
          description: 'These URLs can be updated, but please check your backups first (bugs happen).' +
            ' Notice PeerTube must have been stopped when your ran this script.' +
            ' Can we update these URLs? (y/n)',
          default: 'n',
          validator: /y[es]*|n[o]?/,
          warning: 'Must respond yes or no',
          required: true
        }
      }
    }

    prompt.get(schema, function (err, result) {
      if (err) return rej(err)

      return res(result.confirm?.match(/y/) !== null)
    })
  })
}
