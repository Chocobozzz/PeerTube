/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getHLS } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createSingleServer,
  makeRawRequest,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test video download throttling', function () {
  const maxBytesPerSecond = 200 * 1024 // 200 KB/s

  async function prepareServer (serverNumber: number, downloadConfig: {
    max_total_bytes_per_second: number
    max_bytes_per_ip_per_second: number
  }) {
    const server = await createSingleServer(serverNumber, {
      download: downloadConfig
    })

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])
    await server.config.enableTranscoding({ hls: true, webVideo: true, resolutions: 'min' })

    // Use a fixture that is big enough to be able to measure throttling
    const videoId = (await server.videos.quickUpload({ name: 'download-throttle-' + serverNumber, fixture: '60fps_720p_small.mp4' })).uuid
    await waitJobs([ server ])

    return { server, videoId }
  }

  async function getClassicWebVideoDownload (server: PeerTubeServer, videoId: string) {
    const video = await server.videos.get({ id: videoId })
    const file = video.files.find(f => f.hasVideo === true)

    expect(file).to.exist

    return async () => {
      const res = await makeRawRequest({
        url: file.fileDownloadUrl,
        responseType: 'arraybuffer',
        expectedStatus: HttpStatusCode.OK_200
      })

      return res.body as Buffer
    }
  }

  async function getGeneratedDownload (server: PeerTubeServer, videoId: string) {
    const video = await server.videos.get({ id: videoId })
    const hlsVideoFile = getHLS(video).files.find(f => f.hasVideo === true)

    expect(hlsVideoFile).to.exist

    return () => {
      return server.videos.generateDownload({
        videoId,
        videoFileIds: [ hlsVideoFile.id ]
      })
    }
  }

  async function assertDownloadIsThrottled (download: () => Promise<Buffer>, bytesPerSecond: number) {
    const start = Date.now()
    const body = await download()
    const elapsed = Date.now() - start

    expect(body.length).to.be.greaterThan(0)

    const expectedMinMs = (body.length / bytesPerSecond) * 1000
    expect(elapsed).to.be.at.least(expectedMinMs * 0.7)
  }

  async function assertConcurrentDownloadsShareBandwidth (downloads: (() => Promise<Buffer>)[], bytesPerSecond: number) {
    const start = Date.now()
    const bodies = await Promise.all(downloads.map(download => download()))
    const elapsed = Date.now() - start

    const totalBytes = bodies.reduce((sum, body) => sum + body.length, 0)
    const expectedMinMs = (totalBytes / bytesPerSecond) * 1000

    expect(totalBytes).to.be.greaterThan(0)
    expect(elapsed).to.be.at.least(expectedMinMs * 0.7)
  }

  describe('With max_total_bytes_per_second', function () {
    let server: PeerTubeServer
    let videoId: string

    before(async function () {
      this.timeout(120000)
      ;({ server, videoId } = await prepareServer(1, {
        max_total_bytes_per_second: maxBytesPerSecond,
        max_bytes_per_ip_per_second: null
      }))
    })

    it('Should throttle classic web video downloads', async function () {
      this.timeout(120000)

      await assertDownloadIsThrottled(await getClassicWebVideoDownload(server, videoId), maxBytesPerSecond)
    })

    it('Should throttle generated downloads', async function () {
      this.timeout(120000)

      await assertDownloadIsThrottled(await getGeneratedDownload(server, videoId), maxBytesPerSecond)
    })

    it('Should share bandwidth between concurrent download requests', async function () {
      this.timeout(120000)

      const download = await getClassicWebVideoDownload(server, videoId)

      await assertConcurrentDownloadsShareBandwidth([ download, download ], maxBytesPerSecond)
    })

    after(async function () {
      await cleanupTests([ server ])
    })
  })

  describe('With max_bytes_per_ip_per_second', function () {
    let server: PeerTubeServer
    let videoId: string

    before(async function () {
      this.timeout(120000)
      ;({ server, videoId } = await prepareServer(1, {
        max_total_bytes_per_second: null,
        max_bytes_per_ip_per_second: maxBytesPerSecond
      }))
    })

    it('Should share bandwidth between concurrent requests of the same IP', async function () {
      this.timeout(120000)

      const download = await getClassicWebVideoDownload(server, videoId)

      await assertConcurrentDownloadsShareBandwidth([ download, download ], maxBytesPerSecond)
    })

    after(async function () {
      await cleanupTests([ server ])
    })
  })
})
