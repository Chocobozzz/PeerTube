/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getHLS } from '@peertube/peertube-core-utils'
import { HttpStatusCode, PeerTubeProblemDocument } from '@peertube/peertube-models'
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

describe('Test video downloads enabled/disabled', function () {
  let server: PeerTubeServer
  let videoUUID: string

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])
    await server.config.enableTranscoding({ hls: true, webVideo: true, resolutions: 'min' })

    const { uuid } = await server.videos.quickUpload({ name: 'download enabled' })
    videoUUID = uuid

    await waitJobs([ server ])
  })

  async function getVideoUrls () {
    const video = await server.videos.get({ id: videoUUID })

    return {
      webVideoUrl: video.files[0].fileDownloadUrl,
      torrentUrl: video.files[0].torrentDownloadUrl,
      hlsVideoUrl: getHLS(video).files[0].fileDownloadUrl,
      hlsTorrentUrl: getHLS(video).files[0].torrentDownloadUrl,
      generateFileIds: [ getHLS(video).files[0].id ]
    }
  }

  it('Should download video files when download is enabled', async function () {
    const { webVideoUrl, torrentUrl, hlsVideoUrl, hlsTorrentUrl, generateFileIds } = await getVideoUrls()

    await makeRawRequest({ url: webVideoUrl, expectedStatus: HttpStatusCode.OK_200 })
    await makeRawRequest({ url: torrentUrl, expectedStatus: HttpStatusCode.OK_200 })
    await makeRawRequest({ url: hlsVideoUrl, expectedStatus: HttpStatusCode.OK_200 })
    await makeRawRequest({ url: hlsTorrentUrl, expectedStatus: HttpStatusCode.OK_200 })

    await server.videos.generateDownload({ videoId: videoUUID, videoFileIds: generateFileIds, expectedStatus: HttpStatusCode.OK_200 })
  })

  it('Should not download video files when download is disabled', async function () {
    await server.videos.update({ id: videoUUID, attributes: { downloadEnabled: false } })

    const { webVideoUrl, torrentUrl, hlsVideoUrl, hlsTorrentUrl, generateFileIds } = await getVideoUrls()

    for (const url of [ webVideoUrl, torrentUrl, hlsVideoUrl, hlsTorrentUrl ]) {
      const res = await makeRawRequest({ url, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      expect((res.body as PeerTubeProblemDocument).detail).to.equal('Video download is disabled for this video')
    }

    await server.videos.generateDownload({
      videoId: videoUUID,
      videoFileIds: generateFileIds,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should download video files again when download is reenabled', async function () {
    await server.videos.update({ id: videoUUID, attributes: { downloadEnabled: true } })

    const { webVideoUrl, torrentUrl, hlsVideoUrl, hlsTorrentUrl, generateFileIds } = await getVideoUrls()

    await makeRawRequest({ url: webVideoUrl, expectedStatus: HttpStatusCode.OK_200 })
    await makeRawRequest({ url: torrentUrl, expectedStatus: HttpStatusCode.OK_200 })
    await makeRawRequest({ url: hlsVideoUrl, expectedStatus: HttpStatusCode.OK_200 })
    await makeRawRequest({ url: hlsTorrentUrl, expectedStatus: HttpStatusCode.OK_200 })

    await server.videos.generateDownload({ videoId: videoUUID, videoFileIds: generateFileIds, expectedStatus: HttpStatusCode.OK_200 })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
