/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { cleanupTests, createMultipleServers, doubleFollow, PeerTubeServer, setAccessTokensToServers, waitJobs } from '@shared/extra-utils'
import { HttpStatusCode, UserRole } from '@shared/models'

describe('Test videos files', function () {
  let servers: PeerTubeServer[]

  let webtorrentId: string
  let hlsId: string
  let remoteId: string

  let userToken: string
  let moderatorToken: string

  let validId1: string
  let validId2: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(300_000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    userToken = await servers[0].users.generateUserAndToken('user', UserRole.USER)
    moderatorToken = await servers[0].users.generateUserAndToken('moderator', UserRole.MODERATOR)

    {
      const { uuid } = await servers[1].videos.quickUpload({ name: 'remote video' })
      remoteId = uuid
    }

    {
      await servers[0].config.enableTranscoding(true, true)

      {
        const { uuid } = await servers[0].videos.quickUpload({ name: 'both 1' })
        validId1 = uuid
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
    await servers[0].videos.removeHLSFiles({ videoId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    await servers[0].videos.removeWebTorrentFiles({ videoId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should not delete files of a remote video', async function () {
    await servers[0].videos.removeHLSFiles({ videoId: remoteId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await servers[0].videos.removeWebTorrentFiles({ videoId: remoteId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not delete files by a non admin user', async function () {
    const expectedStatus = HttpStatusCode.FORBIDDEN_403

    await servers[0].videos.removeHLSFiles({ videoId: validId1, token: userToken, expectedStatus })
    await servers[0].videos.removeHLSFiles({ videoId: validId1, token: moderatorToken, expectedStatus })

    await servers[0].videos.removeWebTorrentFiles({ videoId: validId1, token: userToken, expectedStatus })
    await servers[0].videos.removeWebTorrentFiles({ videoId: validId1, token: moderatorToken, expectedStatus })
  })

  it('Should not delete files if the files are not available', async function () {
    await servers[0].videos.removeHLSFiles({ videoId: hlsId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await servers[0].videos.removeWebTorrentFiles({ videoId: webtorrentId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not delete files if no both versions are available', async function () {
    await servers[0].videos.removeHLSFiles({ videoId: hlsId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await servers[0].videos.removeWebTorrentFiles({ videoId: webtorrentId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not delete files if no both versions are available', async function () {
    await servers[0].videos.removeHLSFiles({ videoId: hlsId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await servers[0].videos.removeWebTorrentFiles({ videoId: webtorrentId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should delete files if both versions are available', async function () {
    await servers[0].videos.removeHLSFiles({ videoId: validId1 })
    await servers[0].videos.removeWebTorrentFiles({ videoId: validId2 })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
