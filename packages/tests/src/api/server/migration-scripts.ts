/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectLogDoesNotContain } from '@tests/shared/checks.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'

describe('Test automatic migration scripts', function () {
  let server: PeerTubeServer
  let sqlCommand: SQLCommand

  let videoUUID: string
  let magnetUri: string

  async function getScriptsRun () {
    const rows = await sqlCommand.selectQuery<{ manualMigrationScriptsRun: string[] }>(
      `SELECT "manualMigrationScriptsRun" FROM "application"`
    )

    return rows[0].manualMigrationScriptsRun
  }

  // Only in the description, so the video can only be found using the "videoSearch" table (not with a trigram search on the name)
  async function searchVideos () {
    const { total } = await server.search.searchVideos({ search: 'quokkamigration' })

    return total
  }

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    sqlCommand = new SQLCommand(server)

    const { uuid } = await server.videos.upload({ attributes: { name: 'my video', description: 'a description about quokkamigration' } })
    videoUUID = uuid

    await waitJobs([ server ])

    const video = await server.videos.get({ id: videoUUID })
    magnetUri = video.files[0].magnetUri
    expect(magnetUri).to.exist
  })

  it('Should have marked all migration scripts as run on a fresh install', async function () {
    // Let the scheduler do its first run (1 second after startup in tests)
    await wait(2000)

    expect(await getScriptsRun()).to.include('peertube-8.3')

    // Marked by the installer, not by the scheduler
    await expectLogDoesNotContain(server, 'Running migration script peertube-8.3')
  })

  it('Should run the peertube-8.3 migration script in the background on startup', async function () {
    this.timeout(120000)

    await sqlCommand.updateQuery(
      `UPDATE "application" SET "manualMigrationScriptsRun" = array_remove("manualMigrationScriptsRun", 'peertube-8.3')`
    )
    await sqlCommand.deleteAll('videoSearch')

    await sqlCommand.updateQuery(`ALTER TABLE "videoFile" ADD COLUMN "infoHash" VARCHAR(255)`)
    await sqlCommand.updateQuery(
      `UPDATE "videoFile" SET "infoHash" = ` +
        `(SELECT ENCODE("infohash", 'hex') FROM "videoInfohash" WHERE "videoInfohash"."videoFileId" = "videoFile"."id")`
    )
    await sqlCommand.updateQuery(`DELETE FROM "videoInfohash" WHERE "videoFileId" IS NOT NULL`)

    expect(await searchVideos()).to.equal(0)

    await killallServers([ server ])
    await server.run()

    await server.servers.waitUntilLog('Migration script peertube-8.3 finished')

    expect(await getScriptsRun()).to.include('peertube-8.3')
  })

  it('Should have filled the search table', async function () {
    expect(await searchVideos()).to.equal(1)
  })

  it('Should have migrated the video file infohashes', async function () {
    const columns = await sqlCommand.selectQuery<{ column_name: string }>(
      `SELECT "column_name" FROM "information_schema"."columns" WHERE "table_name" = 'videoFile' AND "column_name" = 'infoHash'`
    )
    expect(columns).to.have.lengthOf(0)

    const video = await server.videos.get({ id: videoUUID })
    expect(video.files[0].magnetUri).to.equal(magnetUri)
  })

  after(async function () {
    await sqlCommand.cleanup()

    await cleanupTests([ server ])
  })
})
