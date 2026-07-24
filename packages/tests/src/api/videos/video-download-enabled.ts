/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getHLS } from '@peertube/peertube-core-utils'
import { HttpStatusCode, PeerTubeProblemDocument, UserRole } from '@peertube/peertube-models'
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
      token: null,
      videoId: videoUUID,
      videoFileIds: generateFileIds,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should allow admin/owner/editors to download video files even if download is disabled', async function () {
    // Download is still disabled from the previous test
    const { webVideoUrl, hlsVideoUrl, generateFileIds } = await getVideoUrls()

    const adminToken = await server.users.generateUserAndToken('admin2', UserRole.ADMINISTRATOR)
    const editorToken = await server.channelCollaborators.createEditor('editor1', server.store.channel.name)

    // Owner of the video is the root account, which uploaded it
    for (const token of [ server.accessToken, adminToken, editorToken ]) {
      await makeRawRequest({ url: webVideoUrl, token, expectedStatus: HttpStatusCode.OK_200 })
      await makeRawRequest({ url: hlsVideoUrl, token, expectedStatus: HttpStatusCode.OK_200 })

      await server.videos.generateDownload({
        token,
        videoId: videoUUID,
        videoFileIds: generateFileIds,
        expectedStatus: HttpStatusCode.OK_200
      })
    }

    // A basic user that does not manage the channel must not bypass the setting
    const userToken = await server.users.generateUserAndToken('user1')

    await makeRawRequest({ url: webVideoUrl, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    await makeRawRequest({ url: hlsVideoUrl, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })

    await server.videos.generateDownload({
      token: userToken,
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
