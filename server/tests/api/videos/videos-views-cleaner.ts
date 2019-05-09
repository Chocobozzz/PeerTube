/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  flushAndRunMultipleServers,
  flushTests,
  killallServers,
  reRunServer,
  flushAndRunServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo, uploadVideoAndGetId, viewVideo, wait, countVideoViewsOf, doubleFollow, waitJobs, cleanupTests
} from '../../../../shared/extra-utils'
import { getVideosOverview } from '../../../../shared/extra-utils/overviews/overviews'
import { VideosOverview } from '../../../../shared/models/overviews'
import { listMyVideosHistory } from '../../../../shared/extra-utils/videos/video-history'

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
        const total = await countVideoViewsOf(server.serverNumber, videoIdServer1)
        expect(total).to.equal(2)
      }
    }

    {
      for (const server of servers) {
        const total = await countVideoViewsOf(server.serverNumber, videoIdServer2)
        expect(total).to.equal(2)
      }
    }
  })

  it('Should clean old video views', async function () {
    this.timeout(50000)

    this.timeout(50000)

    killallServers([ servers[0] ])

    await reRunServer(servers[0], { views: { videos: { remote: { max_age: '5 seconds' } } } })

    await wait(6000)

    // Should still have views

    {
      for (const server of servers) {
        const total = await countVideoViewsOf(server.serverNumber, videoIdServer1)
        expect(total).to.equal(2)
      }
    }

    {
      const totalServer1 = await countVideoViewsOf(servers[0].serverNumber, videoIdServer2)
      expect(totalServer1).to.equal(0)

      const totalServer2 = await countVideoViewsOf(servers[1].serverNumber, videoIdServer2)
      expect(totalServer2).to.equal(2)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
