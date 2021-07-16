/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  wait,
  waitJobs
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Test video views cleaner', function () {
  let servers: ServerInfo[]

  let videoIdServer1: string
  let videoIdServer2: string

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    videoIdServer1 = (await servers[0].videos.quickUpload({ name: 'video server 1' })).uuid
    videoIdServer2 = (await servers[1].videos.quickUpload({ name: 'video server 2' })).uuid

    await waitJobs(servers)

    await servers[0].videos.view({ id: videoIdServer1 })
    await servers[1].videos.view({ id: videoIdServer1 })
    await servers[0].videos.view({ id: videoIdServer2 })
    await servers[1].videos.view({ id: videoIdServer2 })

    await waitJobs(servers)
  })

  it('Should not clean old video views', async function () {
    this.timeout(50000)

    await killallServers([ servers[0] ])

    await reRunServer(servers[0], { views: { videos: { remote: { max_age: '10 days' } } } })

    await wait(6000)

    // Should still have views

    {
      for (const server of servers) {
        const total = await server.sql.countVideoViewsOf(videoIdServer1)
        expect(total).to.equal(2, 'Server ' + server.serverNumber + ' does not have the correct amount of views')
      }
    }

    {
      for (const server of servers) {
        const total = await server.sql.countVideoViewsOf(videoIdServer2)
        expect(total).to.equal(2, 'Server ' + server.serverNumber + ' does not have the correct amount of views')
      }
    }
  })

  it('Should clean old video views', async function () {
    this.timeout(50000)

    await killallServers([ servers[0] ])

    await reRunServer(servers[0], { views: { videos: { remote: { max_age: '5 seconds' } } } })

    await wait(6000)

    // Should still have views

    {
      for (const server of servers) {
        const total = await server.sql.countVideoViewsOf(videoIdServer1)
        expect(total).to.equal(2)
      }
    }

    {
      const totalServer1 = await servers[0].sql.countVideoViewsOf(videoIdServer2)
      expect(totalServer1).to.equal(0)

      const totalServer2 = await servers[1].sql.countVideoViewsOf(videoIdServer2)
      expect(totalServer2).to.equal(2)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
