/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  createMultipleServers,
  doubleFollow,
  killallServers,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test video downloads stats', function () {
  let servers: PeerTubeServer[]
  let videoId: string
  let remoteVideoId: string

  async function processStats () {
    for (const server of servers) {
      await server.debug.sendCommand({ body: { command: 'process-video-stats-buffer' } })
    }

    await waitJobs(servers)
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableMinimumTranscoding()

    {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      videoId = uuid
    }

    {
      const { uuid } = await servers[1].videos.quickUpload({ name: 'remote video' })
      remoteVideoId = uuid
    }

    await waitJobs(servers)
  })

  it('Should count web video downloads', async function () {
    const video = await servers[0].videos.get({ id: remoteVideoId })
    await makeRawRequest({ url: video.files[0].fileDownloadUrl, expectedStatus: HttpStatusCode.OK_200 })

    await processStats()

    for (const server of servers) {
      const video = await server.videos.get({ id: remoteVideoId })
      expect(video.downloads).to.equal(1)
    }
  })

  it('Should count hls downloads', async function () {
    const video = await servers[0].videos.get({ id: videoId })
    await makeRawRequest({ url: video.streamingPlaylists[0].files[0].fileDownloadUrl, expectedStatus: HttpStatusCode.OK_200 })

    await processStats()

    for (const server of servers) {
      const video = await server.videos.get({ id: videoId })
      expect(video.downloads).to.equal(1)
    }
  })

  it('Should count generated download', async function () {
    const video = await servers[0].videos.get({ id: videoId })
    const videoFileIds = [ video.files[0].id ]

    await servers[0].videos.generateDownload({ videoId, videoFileIds })

    await processStats()

    for (const server of servers) {
      const video = await server.videos.get({ id: videoId })
      expect(video.downloads).to.equal(2)
    }
  })

  it('Should count remote download', async function () {
    const video = await servers[1].videos.get({ id: videoId })
    const videoFileIds = [ video.files[0].id ]

    await servers[1].videos.generateDownload({ videoId, videoFileIds })
    await waitJobs(servers)

    await servers[0].debug.sendCommand({ body: { command: 'process-video-stats-buffer' } })
    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: videoId })
      expect(video.downloads).to.equal(3)
    }
  })

  it('Should return time-series for downloads stats', async function () {
    await wait(6000)

    const now = new Date()
    const twoHoursAgo = new Date()
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 4)

    const { data } = await servers[0].videoStats.getTimeserieStats({
      videoId,
      metric: 'downloads',
      startDate: twoHoursAgo,
      endDate: now
    })

    expect(data.reduce((sum, point) => sum + point.value, 0)).to.equal(3)
  })

  after(async function () {
    await killallServers(servers)
  })
})
