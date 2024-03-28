/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  HttpStatusCodeType,
  LiveVideoCreate,
  LiveVideoError,
  VideoPrivacy,
  VideoPrivacyType,
  VideoState,
  VideoStateType
} from '@peertube/peertube-models'
import {
  ConfigCommand,
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  findExternalSavedVideo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  testFfmpegStreamError,
  waitJobs,
  waitUntilLivePublishedOnAllServers,
  waitUntilLiveReplacedByReplayOnAllServers,
  waitUntilLiveWaitingOnAllServers
} from '@peertube/peertube-server-commands'
import { checkLiveCleanup } from '@tests/shared/live.js'
import { expect } from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'

describe('Save replay setting', function () {
  let servers: PeerTubeServer[] = []
  let liveVideoUUID: string
  let ffmpegCommand: FfmpegCommand

  async function createLiveWrapper (options: { permanent: boolean, replay: boolean, replaySettings?: { privacy: VideoPrivacyType } }) {
    if (liveVideoUUID) {
      try {
        await servers[0].videos.remove({ id: liveVideoUUID })
        await waitJobs(servers)
      } catch {}
    }

    const attributes: LiveVideoCreate = {
      channelId: servers[0].store.channel.id,
      privacy: VideoPrivacy.PUBLIC,
      name: 'live'.repeat(30),
      saveReplay: options.replay,
      replaySettings: options.replaySettings,
      permanentLive: options.permanent
    }

    const { uuid } = await servers[0].live.create({ fields: attributes })
    return uuid
  }

  async function publishLive (options: { permanent: boolean, replay: boolean, replaySettings?: { privacy: VideoPrivacyType } }) {
    liveVideoUUID = await createLiveWrapper(options)

    const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoUUID })
    await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)

    const liveDetails = await servers[0].videos.get({ id: liveVideoUUID })

    await waitJobs(servers)
    await checkVideosExist(liveVideoUUID, null, HttpStatusCode.OK_200)

    return { ffmpegCommand, liveDetails }
  }

  async function publishLiveAndDelete (options: { permanent: boolean, replay: boolean, replaySettings?: { privacy: VideoPrivacyType } }) {
    const { ffmpegCommand, liveDetails } = await publishLive(options)

    await Promise.all([
      servers[0].videos.remove({ id: liveVideoUUID }),
      testFfmpegStreamError(ffmpegCommand, true)
    ])

    await waitJobs(servers)
    await wait(5000)
    await waitJobs(servers)

    return { liveDetails }
  }

  async function publishLiveAndBlacklist (options: {
    permanent: boolean
    replay: boolean
    replaySettings?: { privacy: VideoPrivacyType }
  }) {
    const { ffmpegCommand, liveDetails } = await publishLive(options)

    await Promise.all([
      servers[0].blacklist.add({ videoId: liveVideoUUID, reason: 'bad live', unfederate: true }),
      testFfmpegStreamError(ffmpegCommand, true)
    ])

    await waitJobs(servers)
    await wait(5000)
    await waitJobs(servers)

    return { liveDetails }
  }

  async function checkVideosExist (videoId: string, videosLength: number, expectedStatus?: HttpStatusCodeType) {
    for (const server of servers) {
      const { data, total } = await server.videos.list()

      if (videosLength !== null) {
        expect(data).to.have.lengthOf(videosLength)
        expect(total).to.equal(videosLength)
      }

      if (expectedStatus) {
        await server.videos.get({ id: videoId, expectedStatus })
      }
    }
  }

  async function checkVideoState (videoId: string, state: VideoStateType) {
    for (const server of servers) {
      const video = await server.videos.get({ id: videoId })
      expect(video.state.id).to.equal(state)
    }
  }

  async function checkVideoPrivacy (videoId: string, privacy: VideoPrivacyType) {
    for (const server of servers) {
      const video = await server.videos.get({ id: videoId })
      expect(video.privacy.id).to.equal(privacy)
    }
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableMinimumTranscoding()
    await servers[0].config.updateExistingConfig({
      newConfig: {
        live: {
          enabled: true,
          allowReplay: true,
          maxDuration: -1,
          transcoding: {
            enabled: false,
            resolutions: ConfigCommand.getCustomConfigResolutions(true)
          }
        }
      }
    })
  })

  describe('With save replay disabled', function () {
    let sessionStartDateMin: Date
    let sessionStartDateMax: Date
    let sessionEndDateMin: Date

    it('Should correctly create and federate the "waiting for stream" live', async function () {
      this.timeout(40000)

      liveVideoUUID = await createLiveWrapper({ permanent: false, replay: false })

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, 0, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.WAITING_FOR_LIVE)
    })

    it('Should correctly have updated the live and federated it when streaming in the live', async function () {
      this.timeout(120000)

      ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoUUID })

      sessionStartDateMin = new Date()
      await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)
      sessionStartDateMax = new Date()

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, 1, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
    })

    it('Should correctly delete the video files after the stream ended', async function () {
      this.timeout(120000)

      sessionEndDateMin = new Date()
      await stopFfmpeg(ffmpegCommand)

      for (const server of servers) {
        await server.live.waitUntilEnded({ videoId: liveVideoUUID })
      }
      await waitJobs(servers)

      // Live still exist, but cannot be played anymore
      await checkVideosExist(liveVideoUUID, 0, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.LIVE_ENDED)

      // No resolutions saved since we did not save replay
      await checkLiveCleanup({ server: servers[0], videoUUID: liveVideoUUID, permanent: false })
    })

    it('Should have appropriate ended session', async function () {
      const { data, total } = await servers[0].live.listSessions({ videoId: liveVideoUUID })
      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      const session = data[0]

      const startDate = new Date(session.startDate)
      expect(startDate).to.be.above(sessionStartDateMin)
      expect(startDate).to.be.below(sessionStartDateMax)

      expect(session.endDate).to.exist
      expect(new Date(session.endDate)).to.be.above(sessionEndDateMin)

      expect(session.saveReplay).to.be.false
      expect(session.error).to.not.exist
      expect(session.replayVideo).to.not.exist
    })

    it('Should correctly terminate the stream on blacklist and delete the live', async function () {
      this.timeout(120000)

      await publishLiveAndBlacklist({ permanent: false, replay: false })

      await checkVideosExist(liveVideoUUID, 0)

      await servers[0].videos.get({ id: liveVideoUUID, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await servers[1].videos.get({ id: liveVideoUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      await wait(5000)
      await waitJobs(servers)
      await checkLiveCleanup({ server: servers[0], videoUUID: liveVideoUUID, permanent: false })
    })

    it('Should have blacklisted session error', async function () {
      const session = await servers[0].live.findLatestSession({ videoId: liveVideoUUID })
      expect(session.startDate).to.exist
      expect(session.endDate).to.exist

      expect(session.error).to.equal(LiveVideoError.BLACKLISTED)
      expect(session.replayVideo).to.not.exist
    })

    it('Should correctly terminate the stream on delete and delete the video', async function () {
      this.timeout(120000)

      await publishLiveAndDelete({ permanent: false, replay: false })

      await checkVideosExist(liveVideoUUID, 0, HttpStatusCode.NOT_FOUND_404)
      await checkLiveCleanup({ server: servers[0], videoUUID: liveVideoUUID, permanent: false })
    })
  })

  describe('With save replay enabled on non permanent live', function () {

    it('Should correctly create and federate the "waiting for stream" live', async function () {
      this.timeout(120000)

      liveVideoUUID = await createLiveWrapper({ permanent: false, replay: true, replaySettings: { privacy: VideoPrivacy.UNLISTED } })

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, 0, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.WAITING_FOR_LIVE)
      await checkVideoPrivacy(liveVideoUUID, VideoPrivacy.PUBLIC)
    })

    it('Should correctly have updated the live and federated it when streaming in the live', async function () {
      this.timeout(120000)

      ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoUUID })
      await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)

      await waitJobs(servers)

      await checkVideosExist(liveVideoUUID, 1, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
      await checkVideoPrivacy(liveVideoUUID, VideoPrivacy.PUBLIC)
    })

    it('Should correctly have saved the live and federated it after the streaming', async function () {
      this.timeout(120000)

      const session = await servers[0].live.findLatestSession({ videoId: liveVideoUUID })
      expect(session.endDate).to.not.exist
      expect(session.endingProcessed).to.be.false
      expect(session.saveReplay).to.be.true
      expect(session.replaySettings).to.exist
      expect(session.replaySettings.privacy).to.equal(VideoPrivacy.UNLISTED)

      await stopFfmpeg(ffmpegCommand)

      await waitUntilLiveReplacedByReplayOnAllServers(servers, liveVideoUUID)
      await waitJobs(servers)

      // Live has been transcoded
      await checkVideosExist(liveVideoUUID, 0, HttpStatusCode.OK_200)
      await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
      await checkVideoPrivacy(liveVideoUUID, VideoPrivacy.UNLISTED)
    })

    it('Should find the replay live session', async function () {
      const session = await servers[0].live.getReplaySession({ videoId: liveVideoUUID })

      expect(session).to.exist

      expect(session.startDate).to.exist
      expect(session.endDate).to.exist

      expect(session.error).to.not.exist
      expect(session.saveReplay).to.be.true
      expect(session.endingProcessed).to.be.true
      expect(session.replaySettings).to.exist
      expect(session.replaySettings.privacy).to.equal(VideoPrivacy.UNLISTED)

      expect(session.replayVideo).to.exist
      expect(session.replayVideo.id).to.exist
      expect(session.replayVideo.shortUUID).to.exist
      expect(session.replayVideo.uuid).to.equal(liveVideoUUID)
    })

    it('Should update the saved live and correctly federate the updated attributes', async function () {
      this.timeout(120000)

      await servers[0].videos.update({ id: liveVideoUUID, attributes: { name: 'video updated', privacy: VideoPrivacy.PUBLIC } })
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: liveVideoUUID })
        expect(video.name).to.equal('video updated')
        expect(video.isLive).to.be.false
        expect(video.privacy.id).to.equal(VideoPrivacy.PUBLIC)
      }
    })

    it('Should have cleaned up the live files', async function () {
      await checkLiveCleanup({ server: servers[0], videoUUID: liveVideoUUID, permanent: false, savedResolutions: [ 720 ] })
    })

    it('Should correctly terminate the stream on blacklist and blacklist the saved replay video', async function () {
      this.timeout(120000)

      await publishLiveAndBlacklist({ permanent: false, replay: true, replaySettings: { privacy: VideoPrivacy.PUBLIC } })

      await checkVideosExist(liveVideoUUID, 0)

      await servers[0].videos.get({ id: liveVideoUUID, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
      await servers[1].videos.get({ id: liveVideoUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      await wait(5000)
      await waitJobs(servers)
      await checkLiveCleanup({ server: servers[0], videoUUID: liveVideoUUID, permanent: false, savedResolutions: [ 720 ] })
    })

    it('Should correctly terminate the stream on delete and delete the video', async function () {
      this.timeout(120000)

      await publishLiveAndDelete({ permanent: false, replay: true, replaySettings: { privacy: VideoPrivacy.PUBLIC } })

      await checkVideosExist(liveVideoUUID, 0, HttpStatusCode.NOT_FOUND_404)
      await checkLiveCleanup({ server: servers[0], videoUUID: liveVideoUUID, permanent: false })
    })
  })

  describe('With save replay enabled on permanent live', function () {
    let lastReplayUUID: string

    describe('With a first live and its replay', function () {

      before(async function () {
        this.timeout(120000)

        await servers[0].kill()
        await servers[0].run({
          federation: {
            videos: {
              federate_unlisted: false
            }
          }
        })
      })

      it('Should correctly create and federate the "waiting for stream" live', async function () {
        this.timeout(120000)

        liveVideoUUID = await createLiveWrapper({ permanent: true, replay: true, replaySettings: { privacy: VideoPrivacy.UNLISTED } })

        await waitJobs(servers)

        await checkVideosExist(liveVideoUUID, 0, HttpStatusCode.OK_200)
        await checkVideoState(liveVideoUUID, VideoState.WAITING_FOR_LIVE)
        await checkVideoPrivacy(liveVideoUUID, VideoPrivacy.PUBLIC)
      })

      it('Should correctly have updated the live and federated it when streaming in the live', async function () {
        this.timeout(120000)

        ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoUUID })
        await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)

        await waitJobs(servers)

        await checkVideosExist(liveVideoUUID, 1, HttpStatusCode.OK_200)
        await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
        await checkVideoPrivacy(liveVideoUUID, VideoPrivacy.PUBLIC)
      })

      it('Should correctly have saved the live', async function () {
        this.timeout(120000)

        const liveDetails = await servers[0].videos.get({ id: liveVideoUUID })

        await stopFfmpeg(ffmpegCommand)

        await waitUntilLiveWaitingOnAllServers(servers, liveVideoUUID)
        await waitJobs(servers)

        const video = await findExternalSavedVideo(servers[0], liveDetails)
        expect(video).to.exist

        await servers[0].videos.get({ id: video.uuid })
        await servers[1].videos.get({ id: video.uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

        lastReplayUUID = video.uuid
      })

      it('Should federate the replay after updating its privacy to public', async function () {
        this.timeout(120000)

        await servers[0].videos.update({ id: lastReplayUUID, attributes: { privacy: VideoPrivacy.PUBLIC } })
        await waitJobs(servers)

        await servers[1].videos.get({ id: lastReplayUUID, expectedStatus: HttpStatusCode.OK_200 })
      })

      it('Should have appropriate ended session and replay live session', async function () {
        const { data, total } = await servers[0].live.listSessions({ videoId: liveVideoUUID })
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)

        const sessionFromLive = data[0]
        const sessionFromReplay = await servers[0].live.getReplaySession({ videoId: lastReplayUUID })

        for (const session of [ sessionFromLive, sessionFromReplay ]) {
          expect(session.startDate).to.exist
          expect(session.endDate).to.exist

          expect(session.replaySettings).to.exist
          expect(session.replaySettings.privacy).to.equal(VideoPrivacy.UNLISTED)

          expect(session.error).to.not.exist

          expect(session.replayVideo).to.exist
          expect(session.replayVideo.id).to.exist
          expect(session.replayVideo.shortUUID).to.exist
          expect(session.replayVideo.uuid).to.equal(lastReplayUUID)
        }
      })

      it('Should have the first live replay with correct settings', async function () {
        await checkVideosExist(lastReplayUUID, 1, HttpStatusCode.OK_200)
        await checkVideoState(lastReplayUUID, VideoState.PUBLISHED)
        await checkVideoPrivacy(lastReplayUUID, VideoPrivacy.PUBLIC)
      })
    })

    describe('With a second live and its replay', function () {

      it('Should update the replay settings', async function () {
        await servers[0].live.update({ videoId: liveVideoUUID, fields: { replaySettings: { privacy: VideoPrivacy.PUBLIC } } })
        await waitJobs(servers)

        const live = await servers[0].live.get({ videoId: liveVideoUUID })

        expect(live.saveReplay).to.be.true
        expect(live.replaySettings).to.exist
        expect(live.replaySettings.privacy).to.equal(VideoPrivacy.PUBLIC)

      })

      it('Should correctly have updated the live and federated it when streaming in the live', async function () {
        this.timeout(120000)

        ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoUUID })
        await waitUntilLivePublishedOnAllServers(servers, liveVideoUUID)

        await waitJobs(servers)

        await checkVideosExist(liveVideoUUID, 2, HttpStatusCode.OK_200)
        await checkVideoState(liveVideoUUID, VideoState.PUBLISHED)
        await checkVideoPrivacy(liveVideoUUID, VideoPrivacy.PUBLIC)
      })

      it('Should correctly have saved the live and federated it after the streaming', async function () {
        this.timeout(120000)

        const liveDetails = await servers[0].videos.get({ id: liveVideoUUID })

        await stopFfmpeg(ffmpegCommand)

        await waitUntilLiveWaitingOnAllServers(servers, liveVideoUUID)
        await waitJobs(servers)

        const video = await findExternalSavedVideo(servers[0], liveDetails)
        expect(video).to.exist

        for (const server of servers) {
          await server.videos.get({ id: video.uuid })
        }

        lastReplayUUID = video.uuid
      })

      it('Should have appropriate ended session and replay live session', async function () {
        const { data, total } = await servers[0].live.listSessions({ videoId: liveVideoUUID })
        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)

        const sessionFromLive = data[1]
        const sessionFromReplay = await servers[0].live.getReplaySession({ videoId: lastReplayUUID })

        for (const session of [ sessionFromLive, sessionFromReplay ]) {
          expect(session.startDate).to.exist
          expect(session.endDate).to.exist

          expect(session.replaySettings).to.exist
          expect(session.replaySettings.privacy).to.equal(VideoPrivacy.PUBLIC)

          expect(session.error).to.not.exist

          expect(session.replayVideo).to.exist
          expect(session.replayVideo.id).to.exist
          expect(session.replayVideo.shortUUID).to.exist
          expect(session.replayVideo.uuid).to.equal(lastReplayUUID)
        }
      })

      it('Should have the first live replay with correct settings', async function () {
        await checkVideosExist(lastReplayUUID, 2, HttpStatusCode.OK_200)
        await checkVideoState(lastReplayUUID, VideoState.PUBLISHED)
        await checkVideoPrivacy(lastReplayUUID, VideoPrivacy.PUBLIC)
      })

      it('Should have cleaned up the live files', async function () {
        await checkLiveCleanup({ server: servers[0], videoUUID: liveVideoUUID, permanent: false })
      })

      it('Should correctly terminate the stream on blacklist and blacklist the saved replay video', async function () {
        this.timeout(120000)

        await servers[0].videos.remove({ id: lastReplayUUID })
        const { liveDetails } = await publishLiveAndBlacklist({
          permanent: true,
          replay: true,
          replaySettings: { privacy: VideoPrivacy.PUBLIC }
        })

        const replay = await findExternalSavedVideo(servers[0], liveDetails)
        expect(replay).to.exist

        for (const videoId of [ liveVideoUUID, replay.uuid ]) {
          await checkVideosExist(videoId, 1)

          await servers[0].videos.get({ id: videoId, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
          await servers[1].videos.get({ id: videoId, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        }

        await checkLiveCleanup({ server: servers[0], videoUUID: liveVideoUUID, permanent: false })
      })

      it('Should correctly terminate the stream on delete and not save the video', async function () {
        this.timeout(120000)

        const { liveDetails } = await publishLiveAndDelete({
          permanent: true,
          replay: true,
          replaySettings: { privacy: VideoPrivacy.PUBLIC }
        })

        const replay = await findExternalSavedVideo(servers[0], liveDetails)
        expect(replay).to.not.exist

        await checkVideosExist(liveVideoUUID, 1, HttpStatusCode.NOT_FOUND_404)
        await checkLiveCleanup({ server: servers[0], videoUUID: liveVideoUUID, permanent: false })
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
