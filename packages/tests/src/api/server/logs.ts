/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  LogsCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test logs', function () {
  let server: PeerTubeServer
  let logsCommand: LogsCommand

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    logsCommand = server.logs
  })

  describe('With the standard log file', function () {

    it('Should get logs with a start date', async function () {
      this.timeout(60000)

      await server.videos.upload({ attributes: { name: 'video 1' } })
      await waitJobs([ server ])

      const now = new Date()

      await server.videos.upload({ attributes: { name: 'video 2' } })
      await waitJobs([ server ])

      const body = await logsCommand.getLogs({ startDate: now })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('Video with name video 1')).to.be.false
      expect(logsString.includes('Video with name video 2')).to.be.true
    })

    it('Should get logs with an end date', async function () {
      this.timeout(60000)

      await server.videos.upload({ attributes: { name: 'video 3' } })
      await waitJobs([ server ])

      const now1 = new Date()

      await server.videos.upload({ attributes: { name: 'video 4' } })
      await waitJobs([ server ])

      const now2 = new Date()

      await server.videos.upload({ attributes: { name: 'video 5' } })
      await waitJobs([ server ])

      const body = await logsCommand.getLogs({ startDate: now1, endDate: now2 })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('Video with name video 3')).to.be.false
      expect(logsString.includes('Video with name video 4')).to.be.true
      expect(logsString.includes('Video with name video 5')).to.be.false
    })

    it('Should filter by level', async function () {
      this.timeout(60000)

      const now = new Date()

      await server.videos.upload({ attributes: { name: 'video 6' } })
      await waitJobs([ server ])

      {
        const body = await logsCommand.getLogs({ startDate: now, level: 'info' })
        const logsString = JSON.stringify(body)

        expect(logsString.includes('Video with name video 6')).to.be.true
      }

      {
        const body = await logsCommand.getLogs({ startDate: now, level: 'warn' })
        const logsString = JSON.stringify(body)

        expect(logsString.includes('Video with name video 6')).to.be.false
      }
    })

    it('Should filter by tag', async function () {
      const now = new Date()

      const { uuid } = await server.videos.upload({ attributes: { name: 'video 6' } })
      await waitJobs([ server ])

      {
        const body = await logsCommand.getLogs({ startDate: now, level: 'debug', tagsOneOf: [ 'toto' ] })
        expect(body).to.have.lengthOf(0)
      }

      {
        const body = await logsCommand.getLogs({ startDate: now, level: 'debug', tagsOneOf: [ uuid ] })
        expect(body).to.not.have.lengthOf(0)

        for (const line of body) {
          expect(line.tags).to.contain(uuid)
        }
      }
    })

    it('Should log ping/HTTP requests', async function () {
      const now = new Date()

      await server.servers.ping()

      const body = await logsCommand.getLogs({ startDate: now, level: 'info' })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('/api/v1/ping')).to.be.true
      expect(logsString.includes(' HTTP/1.1')).to.be.true
    })

    it('Should not log ping/HTTP requests', async function () {
      this.timeout(60000)

      await killallServers([ server ])

      await server.run({ log: { log_ping_requests: false, log_http_requests: false } })

      const now = new Date()

      await server.servers.ping()
      await server.videos.list()

      const body = await logsCommand.getLogs({ startDate: now, level: 'info' })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('/api/v1/ping')).to.be.false
      expect(logsString.includes(' HTTP/1.1"')).to.be.false
    })
  })

  describe('With the audit log', function () {

    it('Should get logs with a start date', async function () {
      this.timeout(60000)

      await server.videos.upload({ attributes: { name: 'video 7' } })
      await waitJobs([ server ])

      const now = new Date()

      await server.videos.upload({ attributes: { name: 'video 8' } })
      await waitJobs([ server ])

      const body = await logsCommand.getAuditLogs({ startDate: now })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('video 7')).to.be.false
      expect(logsString.includes('video 8')).to.be.true

      expect(body).to.have.lengthOf(1)

      const item = body[0]

      const message = JSON.parse(item.message)
      expect(message.domain).to.equal('videos')
      expect(message.action).to.equal('create')
    })

    it('Should get logs with an end date', async function () {
      this.timeout(60000)

      await server.videos.upload({ attributes: { name: 'video 9' } })
      await waitJobs([ server ])

      const now1 = new Date()

      await server.videos.upload({ attributes: { name: 'video 10' } })
      await waitJobs([ server ])

      const now2 = new Date()

      await server.videos.upload({ attributes: { name: 'video 11' } })
      await waitJobs([ server ])

      const body = await logsCommand.getAuditLogs({ startDate: now1, endDate: now2 })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('video 9')).to.be.false
      expect(logsString.includes('video 10')).to.be.true
      expect(logsString.includes('video 11')).to.be.false
    })
  })

  describe('When creating log from the client', function () {

    it('Should create a warn client log', async function () {
      const now = new Date()

      await server.logs.createLogClient({
        payload: {
          level: 'warn',
          url: 'http://example.com',
          message: 'my super client message'
        },
        token: null
      })

      const body = await logsCommand.getLogs({ startDate: now })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('my super client message')).to.be.true
    })

    it('Should create an error authenticated client log', async function () {
      const now = new Date()

      await server.logs.createLogClient({
        payload: {
          url: 'https://example.com/page1',
          level: 'error',
          message: 'my super client message 2',
          userAgent: 'super user agent',
          meta: '{hello}',
          stackTrace: 'super stack trace'
        }
      })

      const body = await logsCommand.getLogs({ startDate: now })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('my super client message 2')).to.be.true
      expect(logsString.includes('super user agent')).to.be.true
      expect(logsString.includes('super stack trace')).to.be.true
      expect(logsString.includes('{hello}')).to.be.true
      expect(logsString.includes('https://example.com/page1')).to.be.true
    })

    it('Should refuse to create client logs', async function () {
      await server.kill()

      await server.run({
        log: {
          accept_client_log: false
        }
      })

      await server.logs.createLogClient({
        payload: {
          level: 'warn',
          url: 'http://example.com',
          message: 'my super client message'
        },
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('With some log options', function () {

    it('Should not crash when enabling `prettify_sql` config', async function () {
      await server.kill()
      await server.run({ log: { prettify_sql: true } })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
