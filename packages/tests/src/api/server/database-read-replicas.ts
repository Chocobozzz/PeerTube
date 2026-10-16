/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { VideoPrivacy } from '@peertube/peertube-models'
import { areDatabaseStreamingReplicaTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectLogContain, expectLogDoesNotContain } from '@tests/shared/checks.js'
import { PostgresStreamingReplica } from '@tests/shared/postgres-streaming-replica.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'
import { QueryTypes, Sequelize } from 'sequelize'

function buildReplicasConfig (hosts: { hostname: string, port: number }[], maxLag = '5 seconds') {
  return {
    database: {
      read_replicas: {
        max_lag: maxLag,
        hosts
      }
    }
  }
}

async function countReplicaConnections (sqlCommand: SQLCommand, server: PeerTubeServer) {
  const [ { total } ] = await sqlCommand.selectQuery<{ total: string }>(
    `SELECT COUNT(*) AS "total" FROM "pg_stat_activity" WHERE "application_name" = 'peertube-read-replica' AND "datname" = :datname`,
    { datname: 'peertube_test' + server.internalServerNumber }
  )

  return parseInt(total, 10)
}

describe('Test database read replicas', function () {
  let server: PeerTubeServer

  describe('With the primary used as a read only replica', function () {
    let sqlCommand: SQLCommand
    let userToken: string
    let videoUUID: string
    let playlistId: number

    before(async function () {
      this.timeout(120000)

      server = await createSingleServer(1, buildReplicasConfig([ { hostname: '127.0.0.1', port: 5432 } ]))
      await setAccessTokensToServers([ server ])
      await setDefaultVideoChannel([ server ])

      sqlCommand = new SQLCommand(server)

      userToken = await server.users.generateUserAndToken('user1')

      const video = await server.videos.quickUpload({ name: 'replica video' })
      videoUUID = video.uuid

      await server.comments.createThread({ videoId: videoUUID, text: 'replica comment' })
      await server.subscriptions.add({ token: userToken, targetUri: 'root_channel@' + server.host })

      const playlist = await server.playlists.quickCreate({ displayName: 'replica playlist' })
      playlistId = playlist.id
      await server.playlists.addElement({ playlistId, attributes: { videoId: videoUUID } })

      await waitJobs([ server ])
    })

    it('Should use the replica', async function () {
      await expectLogContain(server, 'Using database read replica 127.0.0.1:5432')
    })

    it('Should list content using the replica', async function () {
      {
        const { total, data } = await server.videos.list()
        expect(total).to.equal(1)
        expect(data[0].uuid).to.equal(videoUUID)
      }

      {
        const { total } = await server.videos.listByChannel({ handle: 'root_channel' })
        expect(total).to.equal(1)
      }

      {
        const { total } = await server.videos.listByAccount({ handle: 'root' })
        expect(total).to.equal(1)
      }

      {
        const { total, data } = await server.comments.listThreads({ videoId: videoUUID })
        expect(total).to.equal(1)
        expect(data[0].text).to.equal('replica comment')
      }

      {
        const { total } = await server.playlists.listVideos({ playlistId })
        expect(total).to.equal(1)
      }

      {
        const { data } = await server.playlists.list({ start: 0, count: 10 })
        expect(data.map(p => p.displayName)).to.include('replica playlist')
      }

      {
        const { total } = await server.videos.listMySubscriptionVideos({ token: userToken })
        expect(total).to.equal(1)
      }

      {
        const overview = await server.overviews.getVideos({ page: 1 })
        expect(overview.channels).to.be.an('array')
      }

      {
        const rss = await server.feed.getXML({ feed: 'videos', ignoreCache: true })
        expect(rss).to.contain('replica video')
      }

      expect(await countReplicaConnections(sqlCommand, server)).to.be.greaterThan(0)
    })

    it('Should search videos on the replica', async function () {
      const body = await server.search.searchVideos({ search: 'replica' })
      expect(body.total).to.equal(1)
      expect(body.data[0].uuid).to.equal(videoUUID)
    })

    it('Should upload and transcode a video', async function () {
      this.timeout(120000)

      const { uuid } = await server.videos.quickUpload({ name: 'transcoded video', privacy: VideoPrivacy.PUBLIC })
      await waitJobs([ server ])

      const video = await server.videos.get({ id: uuid })
      expect(video.state.id).to.equal(1)
      expect(video.streamingPlaylists.length + video.files.length).to.be.greaterThan(0)

      const { total } = await server.videos.list()
      expect(total).to.equal(2)
    })

    it('Should not have sent writes to the replica', async function () {
      await expectLogDoesNotContain(server, 'Write query declared as a read')
      await expectLogDoesNotContain(server, 'read-only transaction')
    })

    after(async function () {
      await sqlCommand?.cleanup()
      await cleanupTests([ server ])
    })
  })

  describe('With an unreachable replica', function () {
    before(async function () {
      this.timeout(120000)

      server = await createSingleServer(1, buildReplicasConfig([ { hostname: '127.0.0.1', port: 1 } ]))
      await setAccessTokensToServers([ server ])

      await server.videos.quickUpload({ name: 'video' })
    })

    it('Should fallback to the primary', async function () {
      const { total } = await server.videos.list()
      expect(total).to.equal(1)

      const body = await server.search.searchVideos({ search: 'video' })
      expect(body.total).to.equal(1)
    })

    it('Should warn about the replica', async function () {
      await expectLogContain(server, 'Cannot use database read replica 127.0.0.1:1')
    })

    after(async function () {
      await cleanupTests([ server ])
    })
  })

  describe('With a streaming replica', function () {
    if (areDatabaseStreamingReplicaTestsDisabled()) return

    const postgres = new PostgresStreamingReplica()
    const { primaryPort, replicaPort } = postgres
    const maxLagMs = 5000

    let primaryAdmin: Sequelize
    let replicaAdmin: Sequelize

    let userToken: string
    let videoUUID: string
    let playlistId: number

    function buildAdminConnection (port: number, database = 'postgres') {
      return new Sequelize(database, 'postgres', '', { dialect: 'postgres', host: '127.0.0.1', port, logging: false })
    }

    async function setReplay (enabled: boolean) {
      const fn = enabled
        ? 'pg_wal_replay_resume'
        : 'pg_wal_replay_pause'

      await replicaAdmin.query(`SELECT ${fn}()`, { type: QueryTypes.SELECT })
    }

    before(async function () {
      this.timeout(120000)

      await postgres.start()

      primaryAdmin = buildAdminConnection(primaryPort)
      replicaAdmin = buildAdminConnection(replicaPort)

      // In parallel mode, the server uses a random database name
      server = new PeerTubeServer({ serverNumber: 1 })
      const dbname = 'peertube_test' + server.internalServerNumber

      await primaryAdmin.query(`DROP DATABASE IF EXISTS "${dbname}"`)
      await primaryAdmin.query(`CREATE DATABASE "${dbname}" OWNER peertube`)

      const dbAdmin = buildAdminConnection(primaryPort, dbname)
      await dbAdmin.query('CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent;')
      await dbAdmin.close()

      await server.flushAndRun({
        database: {
          port: primaryPort,
          read_replicas: {
            max_lag: maxLagMs + 'ms',
            hosts: [ { hostname: '127.0.0.1', port: replicaPort } ]
          }
        }
      })

      await setAccessTokensToServers([ server ])
      await setDefaultVideoChannel([ server ])

      userToken = await server.users.generateUserAndToken('user1')

      const video = await server.videos.quickUpload({ name: 'video' })
      videoUUID = video.uuid

      await waitJobs([ server ])
    })

    it('Should use the streaming replica', async function () {
      this.timeout(30000)

      // Replicas are polled every second
      await wait(3000)

      await expectLogContain(server, 'Using database read replica 127.0.0.1:' + replicaPort)
    })

    it('Should read own account after a registration when the replica is paused', async function () {
      this.timeout(30000)

      await server.config.enableSignup(false)

      await setReplay(false)

      await server.registrations.register({ username: 'registered_user' })

      const token = await server.login.getAccessToken({ username: 'registered_user', password: 'password' })

      const { total } = await server.channels.listByAccount({ token, accountName: 'registered_user' })
      expect(total).to.equal(1)

      await setReplay(true)
      await wait(3000)
    })

    it('Should read own writes when the replica is paused', async function () {
      await setReplay(false)

      const playlist = await server.playlists.quickCreate({ token: userToken, displayName: 'user playlist' })
      playlistId = playlist.id

      await server.playlists.addElement({ token: userToken, playlistId, attributes: { videoId: videoUUID } })

      const { total } = await server.playlists.listVideos({ token: userToken, playlistId })
      expect(total).to.equal(1)
    })

    it('Should serve stale reads to anonymous users within the max lag', async function () {
      const { total } = await server.playlists.listVideos({ token: null, playlistId })
      expect(total).to.equal(0)
    })

    it('Should stop using a replica lagging too much', async function () {
      this.timeout(30000)

      await wait(maxLagMs + 2000)

      const { total } = await server.playlists.listVideos({ token: null, playlistId })
      expect(total).to.equal(1)

      await expectLogContain(server, 'Stop using database read replica 127.0.0.1:' + replicaPort)
    })

    it('Should use the replica again when it has caught up', async function () {
      this.timeout(30000)

      await setReplay(true)
      await wait(3000)

      const { total } = await server.playlists.listVideos({ token: null, playlistId })
      expect(total).to.equal(1)

      const logs = (await server.servers.getLogContent()).toString()
      const countLogs = (message: string) => logs.split(message + ' 127.0.0.1:' + replicaPort).length - 1

      const stopLogs = countLogs('Stop using database read replica')
      expect(stopLogs).to.be.at.least(1)
      expect(countLogs('Using database read replica')).to.equal(stopLogs + 1)
    })

    after(async function () {
      if (replicaAdmin) await setReplay(true).catch(() => {})

      await primaryAdmin?.close()
      await replicaAdmin?.close()

      await cleanupTests([ server ])

      await postgres.stop()
    })
  })
})
