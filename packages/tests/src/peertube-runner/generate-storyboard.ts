/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { RunnerJobState, VideoPrivacy } from '@peertube/peertube-models'
import { areHttpImportTestsDisabled } from '@peertube/peertube-node-utils'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  sendRTMPStream,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkPeerTubeRunnerCacheIsEmpty } from '@tests/shared/directories.js'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { PeerTubeRunnerProcess } from '@tests/shared/peertube-runner-process.js'
import { checkNoStoryboard, checkStoryboard } from '@tests/shared/storyboard.js'
import { expect } from 'chai'

describe('Test generate storyboard in peertube-runner program', function () {
  let servers: PeerTubeServer[] = []
  let peertubeRunner: PeerTubeRunnerProcess

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.updateExistingConfig({
      newConfig: {
        storyboards: {
          enabled: true,
          remoteRunners: {
            enabled: true
          }
        }
      }
    })

    const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()

    peertubeRunner = new PeerTubeRunnerProcess(servers[0])
    await peertubeRunner.runServer({ jobType: 'generate-video-storyboard' })
    await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: 'runner' })
  })

  describe('Running storyboard generation', function () {
    describe('Common on filesystem', function () {
      it('Should run generate storyboard on classic file without transcoding', async function () {
        this.timeout(360000)

        const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
        await waitJobs(servers, { runnerJobs: true })

        for (const server of servers) {
          await checkStoryboard({ server, uuid, tilesCount: 5 })
        }
      })

      it('Should run generate storyboard on classic file with transcoding', async function () {
        this.timeout(360000)

        await servers[0].config.enableMinimumTranscoding()

        const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
        await waitJobs(servers, { runnerJobs: true })

        for (const server of servers) {
          await checkStoryboard({ server, uuid, tilesCount: 5 })
        }

        await servers[0].config.disableTranscoding()
      })

      it('Should generate a storyboard after HTTP import', async function () {
        this.timeout(120000)

        if (areHttpImportTestsDisabled()) return

        // 3s video
        const { video } = await servers[0].videoImports.importVideo({
          attributes: {
            targetUrl: FIXTURE_URLS.goodVideo,
            channelId: servers[0].store.channel.id,
            privacy: VideoPrivacy.PUBLIC
          }
        })
        await waitJobs(servers, { runnerJobs: true })

        for (const server of servers) {
          await checkStoryboard({ server, uuid: video.uuid, spriteHeight: 144, tilesCount: 3 })
        }
      })

      it('Should generate a storyboard after torrent import', async function () {
        this.timeout(240000)

        if (areHttpImportTestsDisabled()) return

        // 10s video
        const { video } = await servers[0].videoImports.importVideo({
          attributes: {
            magnetUri: FIXTURE_URLS.magnet,
            channelId: servers[0].store.channel.id,
            privacy: VideoPrivacy.PUBLIC
          }
        })
        await waitJobs(servers, { runnerJobs: true })

        for (const server of servers) {
          await checkStoryboard({ server, uuid: video.uuid, tilesCount: 10 })
        }
      })

      it('Should generate a storyboard after a live', async function () {
        this.timeout(240000)

        await servers[0].config.enableMinimumTranscoding()
        await servers[0].config.enableLive({ allowReplay: true, transcoding: true, resolutions: 'min' })

        const { live, video } = await servers[0].live.quickCreate({
          saveReplay: true,
          permanentLive: false,
          privacy: VideoPrivacy.PUBLIC
        })

        const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
        await servers[0].live.waitUntilPublished({ videoId: video.id })

        await stopFfmpeg(ffmpegCommand)

        await servers[0].live.waitUntilReplacedByReplay({ videoId: video.id })
        await waitJobs(servers, { runnerJobs: true })

        for (const server of servers) {
          await checkStoryboard({ server, uuid: video.uuid })
        }
      })
    })

    describe('When generate storyboard is not enabled in runner', function () {
      before(async function () {
        await peertubeRunner.unregisterPeerTubeInstance({ runnerName: 'runner' })
        peertubeRunner.kill()
        await wait(500)

        const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()
        await peertubeRunner.runServer({ jobType: 'live-rtmp-hls-transcoding' })
        await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: 'runner' })
      })

      it('Should not run generate storyboard', async function () {
        this.timeout(60000)

        const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
        await waitJobs(servers)
        await wait(2000)

        const { data } = await servers[0].runnerJobs.list({ stateOneOf: [ RunnerJobState.PENDING ] })
        expect(data.some(j => j.type === 'generate-video-storyboard')).to.be.true

        await checkNoStoryboard({ server: servers[0], uuid })
      })
    })

    describe('Check cleanup', function () {
      it('Should have an empty cache directory', async function () {
        await checkPeerTubeRunnerCacheIsEmpty(peertubeRunner, 'storyboard')
      })
    })
  })

  after(async function () {
    if (peertubeRunner) {
      await peertubeRunner.unregisterPeerTubeInstance({ runnerName: 'runner' })
      peertubeRunner.kill()
    }

    await cleanupTests(servers)
  })
})
