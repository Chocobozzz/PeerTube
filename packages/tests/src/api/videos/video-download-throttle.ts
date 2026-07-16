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

  describe('With byte range requests', function () {
    let server: PeerTubeServer
    let fileUrl: string
    let fullBody: Buffer

    before(async function () {
      this.timeout(120000)

      const { server: s, videoId } = await prepareServer(1, {
        // High enough to not slow down the test
        max_total_bytes_per_second: 10 * 1024 * 1024,
        max_bytes_per_ip_per_second: null
      })
      server = s

      const video = await server.videos.get({ id: videoId })
      fileUrl = video.files.find(f => f.hasVideo === true).fileDownloadUrl

      fullBody = await (await getClassicWebVideoDownload(server, videoId))()
    })

    it('Should download the full file when no Range header is sent', async function () {
      const res = await makeRawRequest({
        url: fileUrl,
        responseType: 'arraybuffer',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.headers['accept-ranges']).to.equal('bytes')
      expect(res.headers['content-length']).to.equal('' + fullBody.length)
      expect(res.body as Buffer).to.deep.equal(fullBody)
    })

    it('Should support a Range header with a start and an end', async function () {
      const res = await makeRawRequest({
        url: fileUrl,
        responseType: 'arraybuffer',
        range: 'bytes=0-99',
        expectedStatus: HttpStatusCode.PARTIAL_CONTENT_206
      })

      expect(res.headers['content-range']).to.equal(`bytes 0-99/${fullBody.length}`)
      expect(res.headers['content-length']).to.equal('100')
      expect(res.body as Buffer).to.deep.equal(fullBody.subarray(0, 100))
    })

    it('Should support a Range header with only a start', async function () {
      const res = await makeRawRequest({
        url: fileUrl,
        responseType: 'arraybuffer',
        range: 'bytes=100-',
        expectedStatus: HttpStatusCode.PARTIAL_CONTENT_206
      })

      expect(res.headers['content-range']).to.equal(`bytes 100-${fullBody.length - 1}/${fullBody.length}`)
      expect(res.body as Buffer).to.deep.equal(fullBody.subarray(100))
    })

    it('Should support a Range header with only a suffix length', async function () {
      const res = await makeRawRequest({
        url: fileUrl,
        responseType: 'arraybuffer',
        range: 'bytes=-100',
        expectedStatus: HttpStatusCode.PARTIAL_CONTENT_206
      })

      const expectedStart = fullBody.length - 100
      expect(res.headers['content-range']).to.equal(`bytes ${expectedStart}-${fullBody.length - 1}/${fullBody.length}`)
      expect(res.body as Buffer).to.deep.equal(fullBody.subarray(expectedStart))
    })

    it('Should ignore a malformed Range header and return the full file', async function () {
      const res = await makeRawRequest({
        url: fileUrl,
        responseType: 'arraybuffer',
        range: 'bytes=abc-def',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body as Buffer).to.deep.equal(fullBody)
    })

    it('Should return 416 for an out of range Range header', async function () {
      const res = await makeRawRequest({
        url: fileUrl,
        range: `bytes=${fullBody.length + 1000}-`,
        expectedStatus: HttpStatusCode.RANGE_NOT_SATISFIABLE_416
      })

      expect(res.headers['content-range']).to.equal(`bytes */${fullBody.length}`)
    })

    after(async function () {
      await cleanupTests([ server ])
    })
  })
})
