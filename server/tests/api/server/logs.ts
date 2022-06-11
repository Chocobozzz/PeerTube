/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  LogsCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/extra-utils'

const expect = chai.expect

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
      this.timeout(20000)

      await server.videos.upload({ attributes: { name: 'video 1' } })
      await waitJobs([ server ])

      const now = new Date()

      await server.videos.upload({ attributes: { name: 'video 2' } })
      await waitJobs([ server ])

      const body = await logsCommand.getLogs({ startDate: now })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('video 1')).to.be.false
      expect(logsString.includes('video 2')).to.be.true
    })

    it('Should get logs with an end date', async function () {
      this.timeout(30000)

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

      expect(logsString.includes('video 3')).to.be.false
      expect(logsString.includes('video 4')).to.be.true
      expect(logsString.includes('video 5')).to.be.false
    })

    it('Should get filter by level', async function () {
      this.timeout(20000)

      const now = new Date()

      await server.videos.upload({ attributes: { name: 'video 6' } })
      await waitJobs([ server ])

      {
        const body = await logsCommand.getLogs({ startDate: now, level: 'info' })
        const logsString = JSON.stringify(body)

        expect(logsString.includes('video 6')).to.be.true
      }

      {
        const body = await logsCommand.getLogs({ startDate: now, level: 'warn' })
        const logsString = JSON.stringify(body)

        expect(logsString.includes('video 6')).to.be.false
      }
    })

    it('Should log ping requests', async function () {
      this.timeout(10000)

      const now = new Date()

      await server.servers.ping()

      const body = await logsCommand.getLogs({ startDate: now, level: 'info' })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('/api/v1/ping')).to.be.true
    })

    it('Should not log ping requests', async function () {
      this.timeout(30000)

      await killallServers([ server ])

      await server.run({ log: { log_ping_requests: false } })

      const now = new Date()

      await server.servers.ping()

      const body = await logsCommand.getLogs({ startDate: now, level: 'info' })
      const logsString = JSON.stringify(body)

      expect(logsString.includes('/api/v1/ping')).to.be.false
    })
  })

  describe('With the audit log', function () {
    it('Should get logs with a start date', async function () {
      this.timeout(20000)

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
      this.timeout(30000)

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

  after(async function () {
    await cleanupTests([ server ])
  })
})
