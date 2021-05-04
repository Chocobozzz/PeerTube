/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { HttpStatusCode, randomInt } from '@shared/core-utils'
import { getGoodVideoUrl, getMagnetURI, getMyVideoImports, importVideo } from '@shared/extra-utils/videos/video-imports'
import { MyUser, VideoImport, VideoImportState, VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  flushAndRunServer,
  getMyUserInformation,
  immutableAssign,
  registerUser,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateUser,
  uploadVideo,
  userLogin,
  waitJobs
} from '../../../../shared/extra-utils'

describe('Test upload quota', function () {
  let server: ServerInfo
  let rootId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    const res = await getMyUserInformation(server.url, server.accessToken)
    rootId = (res.body as MyUser).id

    await updateUser({
      url: server.url,
      userId: rootId,
      accessToken: server.accessToken,
      videoQuota: 42
    })
  })

  describe('When having a video quota', function () {

    it('Should fail with a registered user having too many videos with legacy upload', async function () {
      this.timeout(30000)

      const user = { username: 'registered' + randomInt(1, 1500), password: 'password' }
      await registerUser(server.url, user.username, user.password)
      const userAccessToken = await userLogin(server, user)

      const videoAttributes = { fixture: 'video_short2.webm' }
      for (let i = 0; i < 5; i++) {
        await uploadVideo(server.url, userAccessToken, videoAttributes)
      }

      await uploadVideo(server.url, userAccessToken, videoAttributes, HttpStatusCode.PAYLOAD_TOO_LARGE_413, 'legacy')
    })

    it('Should fail with a registered user having too many videos with resumable upload', async function () {
      this.timeout(30000)

      const user = { username: 'registered' + randomInt(1, 1500), password: 'password' }
      await registerUser(server.url, user.username, user.password)
      const userAccessToken = await userLogin(server, user)

      const videoAttributes = { fixture: 'video_short2.webm' }
      for (let i = 0; i < 5; i++) {
        await uploadVideo(server.url, userAccessToken, videoAttributes)
      }

      await uploadVideo(server.url, userAccessToken, videoAttributes, HttpStatusCode.PAYLOAD_TOO_LARGE_413, 'resumable')
    })

    it('Should fail to import with HTTP/Torrent/magnet', async function () {
      this.timeout(120000)

      const baseAttributes = {
        channelId: server.videoChannel.id,
        privacy: VideoPrivacy.PUBLIC
      }
      await importVideo(server.url, server.accessToken, immutableAssign(baseAttributes, { targetUrl: getGoodVideoUrl() }))
      await importVideo(server.url, server.accessToken, immutableAssign(baseAttributes, { magnetUri: getMagnetURI() }))
      await importVideo(server.url, server.accessToken, immutableAssign(baseAttributes, { torrentfile: 'video-720p.torrent' as any }))

      await waitJobs([ server ])

      const res = await getMyVideoImports(server.url, server.accessToken)

      expect(res.body.total).to.equal(3)
      const videoImports: VideoImport[] = res.body.data
      expect(videoImports).to.have.lengthOf(3)

      for (const videoImport of videoImports) {
        expect(videoImport.state.id).to.equal(VideoImportState.FAILED)
        expect(videoImport.error).not.to.be.undefined
        expect(videoImport.error).to.contain('user video quota is exceeded')
      }
    })
  })

  describe('When having a daily video quota', function () {

    it('Should fail with a user having too many videos daily', async function () {
      await updateUser({
        url: server.url,
        userId: rootId,
        accessToken: server.accessToken,
        videoQuotaDaily: 42
      })

      await uploadVideo(server.url, server.accessToken, {}, HttpStatusCode.PAYLOAD_TOO_LARGE_413, 'legacy')
      await uploadVideo(server.url, server.accessToken, {}, HttpStatusCode.PAYLOAD_TOO_LARGE_413, 'resumable')
    })
  })

  describe('When having an absolute and daily video quota', function () {
    it('Should fail if exceeding total quota', async function () {
      await updateUser({
        url: server.url,
        userId: rootId,
        accessToken: server.accessToken,
        videoQuota: 42,
        videoQuotaDaily: 1024 * 1024 * 1024
      })

      await uploadVideo(server.url, server.accessToken, {}, HttpStatusCode.PAYLOAD_TOO_LARGE_413, 'legacy')
      await uploadVideo(server.url, server.accessToken, {}, HttpStatusCode.PAYLOAD_TOO_LARGE_413, 'resumable')
    })

    it('Should fail if exceeding daily quota', async function () {
      await updateUser({
        url: server.url,
        userId: rootId,
        accessToken: server.accessToken,
        videoQuota: 1024 * 1024 * 1024,
        videoQuotaDaily: 42
      })

      await uploadVideo(server.url, server.accessToken, {}, HttpStatusCode.PAYLOAD_TOO_LARGE_413, 'legacy')
      await uploadVideo(server.url, server.accessToken, {}, HttpStatusCode.PAYLOAD_TOO_LARGE_413, 'resumable')
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
