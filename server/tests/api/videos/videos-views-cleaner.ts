/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  closeAllSequelize,
  countVideoViewsOf,
  doubleFollow,
  flushAndRunMultipleServers,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideoAndGetId,
  viewVideo,
  wait,
  waitJobs
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Test video views cleaner', function () {
  let servers: ServerInfo[]

  let videoIdServer1: string
  let videoIdServer2: string

  before(async function () {
    this.timeout(50000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    videoIdServer1 = (await uploadVideoAndGetId({ server: servers[0], videoName: 'video server 1' })).uuid
    videoIdServer2 = (await uploadVideoAndGetId({ server: servers[1], videoName: 'video server 2' })).uuid

    await waitJobs(servers)

    await viewVideo(servers[0].url, videoIdServer1)
    await viewVideo(servers[1].url, videoIdServer1)
    await viewVideo(servers[0].url, videoIdServer2)
    await viewVideo(servers[1].url, videoIdServer2)

    await waitJobs(servers)
  })

  it('Should not clean old video views', async function () {
    this.timeout(50000)

    killallServers([ servers[0] ])

    await reRunServer(servers[0], { views: { videos: { remote: { max_age: '10 days' } } } })

    await wait(6000)

    // Should still have views

    {
      for (const server of servers) {
        const total = await countVideoViewsOf(server.internalServerNumber, videoIdServer1)
        expect(total).to.equal(2)
      }
    }

    {
      for (const server of servers) {
        const total = await countVideoViewsOf(server.internalServerNumber, videoIdServer2)
        expect(total).to.equal(2)
      }
    }
  })

  it('Should clean old video views', async function () {
    this.timeout(50000)

    killallServers([ servers[0] ])

    await reRunServer(servers[0], { views: { videos: { remote: { max_age: '5 seconds' } } } })

    await wait(6000)

    // Should still have views

    {
      for (const server of servers) {
        const total = await countVideoViewsOf(server.internalServerNumber, videoIdServer1)
        expect(total).to.equal(2)
      }
    }

    {
      const totalServer1 = await countVideoViewsOf(servers[0].internalServerNumber, videoIdServer2)
      expect(totalServer1).to.equal(0)

      const totalServer2 = await countVideoViewsOf(servers[1].internalServerNumber, videoIdServer2)
      expect(totalServer2).to.equal(2)
    }
  })

  after(async function () {
    await closeAllSequelize(servers)

    await cleanupTests(servers)
  })
})
