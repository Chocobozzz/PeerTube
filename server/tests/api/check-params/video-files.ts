/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getAllFiles } from '@shared/core-utils'
import { HttpStatusCode, UserRole, VideoDetails, VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

describe('Test videos files', function () {
  let servers: PeerTubeServer[]

  let userToken: string
  let moderatorToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(300_000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    userToken = await servers[0].users.generateUserAndToken('user', UserRole.USER)
    moderatorToken = await servers[0].users.generateUserAndToken('moderator', UserRole.MODERATOR)
  })

  describe('Getting metadata', function () {
    let video: VideoDetails

    before(async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video', privacy: VideoPrivacy.PRIVATE })
      video = await servers[0].videos.getWithToken({ id: uuid })
    })

    it('Should not get metadata of private video without token', async function () {
      for (const file of getAllFiles(video)) {
        await makeRawRequest({ url: file.metadataUrl, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      }
    })

    it('Should not get metadata of private video without the appropriate token', async function () {
      for (const file of getAllFiles(video)) {
        await makeRawRequest({ url: file.metadataUrl, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      }
    })

    it('Should get metadata of private video with the appropriate token', async function () {
      for (const file of getAllFiles(video)) {
        await makeRawRequest({ url: file.metadataUrl, token: servers[0].accessToken, expectedStatus: HttpStatusCode.OK_200 })
      }
    })
  })

  describe('Deleting files', function () {
    let webtorrentId: string
    let hlsId: string
    let remoteId: string

    let validId1: string
    let validId2: string

    let hlsFileId: number
    let webtorrentFileId: number

    let remoteHLSFileId: number
    let remoteWebtorrentFileId: number

    before(async function () {
      this.timeout(300_000)

      {
        const { uuid } = await servers[1].videos.quickUpload({ name: 'remote video' })
        await waitJobs(servers)

        const video = await servers[1].videos.get({ id: uuid })
        remoteId = video.uuid
        remoteHLSFileId = video.streamingPlaylists[0].files[0].id
        remoteWebtorrentFileId = video.files[0].id
      }

      {
        await servers[0].config.enableTranscoding(true, true)

        {
          const { uuid } = await servers[0].videos.quickUpload({ name: 'both 1' })
          await waitJobs(servers)

          const video = await servers[0].videos.get({ id: uuid })
          validId1 = video.uuid
          hlsFileId = video.streamingPlaylists[0].files[0].id
          webtorrentFileId = video.files[0].id
        }

        {
          const { uuid } = await servers[0].videos.quickUpload({ name: 'both 2' })
          validId2 = uuid
        }
      }

      await waitJobs(servers)

      {
        await servers[0].config.enableTranscoding(false, true)
        const { uuid } = await servers[0].videos.quickUpload({ name: 'hls' })
        hlsId = uuid
      }

      await waitJobs(servers)

      {
        await servers[0].config.enableTranscoding(false, true)
        const { uuid } = await servers[0].videos.quickUpload({ name: 'webtorrent' })
        webtorrentId = uuid
      }

      await waitJobs(servers)
    })

    it('Should not delete files of a unknown video', async function () {
      const expectedStatus = HttpStatusCode.NOT_FOUND_404

      await servers[0].videos.removeHLSPlaylist({ videoId: 404, expectedStatus })
      await servers[0].videos.removeAllWebTorrentFiles({ videoId: 404, expectedStatus })

      await servers[0].videos.removeHLSFile({ videoId: 404, fileId: hlsFileId, expectedStatus })
      await servers[0].videos.removeWebTorrentFile({ videoId: 404, fileId: webtorrentFileId, expectedStatus })
    })

    it('Should not delete unknown files', async function () {
      const expectedStatus = HttpStatusCode.NOT_FOUND_404

      await servers[0].videos.removeHLSFile({ videoId: validId1, fileId: webtorrentFileId, expectedStatus })
      await servers[0].videos.removeWebTorrentFile({ videoId: validId1, fileId: hlsFileId, expectedStatus })
    })

    it('Should not delete files of a remote video', async function () {
      const expectedStatus = HttpStatusCode.BAD_REQUEST_400

      await servers[0].videos.removeHLSPlaylist({ videoId: remoteId, expectedStatus })
      await servers[0].videos.removeAllWebTorrentFiles({ videoId: remoteId, expectedStatus })

      await servers[0].videos.removeHLSFile({ videoId: remoteId, fileId: remoteHLSFileId, expectedStatus })
      await servers[0].videos.removeWebTorrentFile({ videoId: remoteId, fileId: remoteWebtorrentFileId, expectedStatus })
    })

    it('Should not delete files by a non admin user', async function () {
      const expectedStatus = HttpStatusCode.FORBIDDEN_403

      await servers[0].videos.removeHLSPlaylist({ videoId: validId1, token: userToken, expectedStatus })
      await servers[0].videos.removeHLSPlaylist({ videoId: validId1, token: moderatorToken, expectedStatus })

      await servers[0].videos.removeAllWebTorrentFiles({ videoId: validId1, token: userToken, expectedStatus })
      await servers[0].videos.removeAllWebTorrentFiles({ videoId: validId1, token: moderatorToken, expectedStatus })

      await servers[0].videos.removeHLSFile({ videoId: validId1, fileId: hlsFileId, token: userToken, expectedStatus })
      await servers[0].videos.removeHLSFile({ videoId: validId1, fileId: hlsFileId, token: moderatorToken, expectedStatus })

      await servers[0].videos.removeWebTorrentFile({ videoId: validId1, fileId: webtorrentFileId, token: userToken, expectedStatus })
      await servers[0].videos.removeWebTorrentFile({ videoId: validId1, fileId: webtorrentFileId, token: moderatorToken, expectedStatus })
    })

    it('Should not delete files if the files are not available', async function () {
      await servers[0].videos.removeHLSPlaylist({ videoId: hlsId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await servers[0].videos.removeAllWebTorrentFiles({ videoId: webtorrentId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      await servers[0].videos.removeHLSFile({ videoId: hlsId, fileId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      await servers[0].videos.removeWebTorrentFile({ videoId: webtorrentId, fileId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should not delete files if no both versions are available', async function () {
      await servers[0].videos.removeHLSPlaylist({ videoId: hlsId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      await servers[0].videos.removeAllWebTorrentFiles({ videoId: webtorrentId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should delete files if both versions are available', async function () {
      await servers[0].videos.removeHLSFile({ videoId: validId1, fileId: hlsFileId })
      await servers[0].videos.removeWebTorrentFile({ videoId: validId1, fileId: webtorrentFileId })

      await servers[0].videos.removeHLSPlaylist({ videoId: validId1 })
      await servers[0].videos.removeAllWebTorrentFiles({ videoId: validId2 })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
