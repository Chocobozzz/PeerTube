/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { RunnerJobState } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  ObjectStorageCommand,
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkPeerTubeRunnerCacheIsEmpty } from '@tests/shared/directories.js'
import { PeerTubeRunnerProcess } from '@tests/shared/peertube-runner-process.js'
import { checkAutoCaption, checkLanguage, checkNoCaption, uploadForTranscription } from '@tests/shared/transcription.js'
import { expect } from 'chai'

describe('Test transcription in peertube-runner program', function () {
  let servers: PeerTubeServer[] = []
  let peertubeRunner: PeerTubeRunnerProcess

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscription({ remote: true })

    const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()

    peertubeRunner = new PeerTubeRunnerProcess(servers[0])
    await peertubeRunner.runServer({ jobType: 'video-transcription' })
    await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: 'runner' })
  })

  describe('Running transcription', function () {

    describe('Common on filesystem', function () {

      it('Should run transcription on classic file', async function () {
        this.timeout(360000)

        const uuid = await uploadForTranscription(servers[0])
        await waitJobs(servers, { runnerJobs: true })

        await checkAutoCaption({ servers, uuid })
        await checkLanguage(servers, uuid, 'en')
      })

      it('Should run transcription on HLS with audio separated', async function () {
        await servers[0].config.enableMinimumTranscoding({ hls: true, webVideo: false, splitAudioAndVideo: true })

        const uuid = await uploadForTranscription(servers[0], { generateTranscription: false })
        await waitJobs(servers)
        await checkLanguage(servers, uuid, null)

        await servers[0].captions.runGenerate({ videoId: uuid })
        await waitJobs(servers, { runnerJobs: true })

        await checkAutoCaption({ servers, uuid })
        await checkLanguage(servers, uuid, 'en')
      })

      it('Should not run transcription on video without audio stream', async function () {
        this.timeout(360000)

        const uuid = await uploadForTranscription(servers[0], { fixture: 'video_short_no_audio.mp4' })

        await waitJobs(servers)

        let continueWhile = true
        while (continueWhile) {
          await wait(500)

          const { data } = await servers[0].runnerJobs.list({ stateOneOf: [ RunnerJobState.ERRORED ] })

          continueWhile = !data.some(j => j.type === 'video-transcription')
        }

        await checkNoCaption(servers, uuid)
        await checkLanguage(servers, uuid, null)
      })
    })

    describe('On object storage', function () {
      if (areMockObjectStorageTestsDisabled()) return

      const objectStorage = new ObjectStorageCommand()

      before(async function () {
        this.timeout(120000)

        const configOverride = objectStorage.getDefaultMockConfig()
        await objectStorage.prepareDefaultMockBuckets()

        await servers[0].kill()
        await servers[0].run(configOverride)
      })

      it('Should run transcription and upload it on object storage', async function () {
        this.timeout(360000)

        const uuid = await uploadForTranscription(servers[0])
        await waitJobs(servers, { runnerJobs: true })

        await checkAutoCaption({ servers, uuid, objectStorageBaseUrl: objectStorage.getMockCaptionFileBaseUrl() })
        await checkLanguage(servers, uuid, 'en')
      })

      after(async function () {
        await objectStorage.cleanupMock()
      })
    })

    describe('When transcription is not enabled in runner', function () {

      before(async function () {
        await peertubeRunner.unregisterPeerTubeInstance({ runnerName: 'runner' })
        peertubeRunner.kill()
        await wait(500)

        const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()
        await peertubeRunner.runServer({ jobType: 'live-rtmp-hls-transcoding' })
        await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: 'runner' })
      })

      it('Should not run transcription', async function () {
        this.timeout(60000)

        const uuid = await uploadForTranscription(servers[0])
        await waitJobs(servers)
        await wait(2000)

        const { data } = await servers[0].runnerJobs.list({ stateOneOf: [ RunnerJobState.PENDING ] })
        expect(data.some(j => j.type === 'video-transcription')).to.be.true

        await checkNoCaption(servers, uuid)
        await checkLanguage(servers, uuid, null)
      })
    })

    describe('Check cleanup', function () {

      it('Should have an empty cache directory', async function () {
        await checkPeerTubeRunnerCacheIsEmpty(peertubeRunner, 'transcription')
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
