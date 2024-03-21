/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { randomInt } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoImportState, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  VideosCommand,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test upload quota', function () {
  let server: PeerTubeServer
  let rootId: number
  let command: VideosCommand

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    const user = await server.users.getMyInfo()
    rootId = user.id

    await server.users.update({ userId: rootId, videoQuota: 42 })

    command = server.videos
  })

  describe('When having a video quota', function () {

    it('Should fail with a registered user having too many videos with legacy upload', async function () {
      this.timeout(120000)

      const user = { username: 'registered' + randomInt(1, 1500), password: 'password' }
      await server.registrations.register(user)
      const userToken = await server.login.getAccessToken(user)

      const attributes = { fixture: 'video_short2.webm' }
      for (let i = 0; i < 5; i++) {
        await command.upload({ token: userToken, attributes })
      }

      await command.upload({ token: userToken, attributes, expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413, mode: 'legacy' })
    })

    it('Should fail with a registered user having too many videos with resumable upload', async function () {
      this.timeout(120000)

      const user = { username: 'registered' + randomInt(1, 1500), password: 'password' }
      await server.registrations.register(user)
      const userToken = await server.login.getAccessToken(user)

      const attributes = { fixture: 'video_short2.webm' }
      for (let i = 0; i < 5; i++) {
        await command.upload({ token: userToken, attributes })
      }

      await command.upload({ token: userToken, attributes, expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413, mode: 'resumable' })
    })

    it('Should fail to import with HTTP/Torrent/magnet', async function () {
      this.timeout(120_000)

      const baseAttributes = {
        channelId: server.store.channel.id,
        privacy: VideoPrivacy.PUBLIC
      }
      await server.videoImports.importVideo({ attributes: { ...baseAttributes, targetUrl: FIXTURE_URLS.goodVideo } })
      await server.videoImports.importVideo({ attributes: { ...baseAttributes, magnetUri: FIXTURE_URLS.magnet } })
      await server.videoImports.importVideo({ attributes: { ...baseAttributes, torrentfile: 'video-720p.torrent' as any } })

      await waitJobs([ server ])

      const { total, data: videoImports } = await server.videoImports.getMyVideoImports()
      expect(total).to.equal(3)

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
      await server.users.update({ userId: rootId, videoQuotaDaily: 42 })

      await command.upload({ expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413, mode: 'legacy' })
      await command.upload({ expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413, mode: 'resumable' })
    })
  })

  describe('When having an absolute and daily video quota', function () {
    it('Should fail if exceeding total quota', async function () {
      await server.users.update({
        userId: rootId,
        videoQuota: 42,
        videoQuotaDaily: 1024 * 1024 * 1024
      })

      await command.upload({ expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413, mode: 'legacy' })
      await command.upload({ expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413, mode: 'resumable' })
    })

    it('Should fail if exceeding daily quota', async function () {
      await server.users.update({
        userId: rootId,
        videoQuota: 1024 * 1024 * 1024,
        videoQuotaDaily: 42
      })

      await command.upload({ expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413, mode: 'legacy' })
      await command.upload({ expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413, mode: 'resumable' })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
