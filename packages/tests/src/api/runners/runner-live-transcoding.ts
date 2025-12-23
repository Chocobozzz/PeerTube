/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { readFile } from 'fs/promises'
import { wait } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  LiveRTMPHLSTranscodingUpdatePayload,
  LiveVideo,
  LiveVideoError,
  LiveVideoErrorType,
  RunnerJob,
  RunnerJobLiveRTMPHLSTranscodingPayload,
  Video,
  VideoPrivacy,
  VideoState
} from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSingleServer,
  makeRawRequest,
  PeerTubeServer,
  sendRTMPStream,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  testFfmpegStreamError,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test runner live transcoding', function () {
  let server: PeerTubeServer
  let runnerToken: string
  let baseUrl: string

  before(async function () {
    this.timeout(120_000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableRemoteTranscoding()
    await server.config.enableTranscoding()
    runnerToken = await server.runners.autoRegisterRunner()

    baseUrl = server.url + '/static/streaming-playlists/hls'
  })

  describe('Without transcoding enabled', function () {

    before(async function () {
      await server.config.enableLive({
        allowReplay: false,
        resolutions: 'min',
        transcoding: false
      })
    })

    it('Should not have available jobs', async function () {
      this.timeout(120000)

      const { live, video } = await server.live.quickCreate({ permanentLive: true, saveReplay: false, privacy: VideoPrivacy.PUBLIC })

      const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
      await server.live.waitUntilPublished({ videoId: video.id })

      await waitJobs([ server ])

      const { availableJobs } = await server.runnerJobs.requestLive({ runnerToken })
      expect(availableJobs).to.have.lengthOf(0)

      await stopFfmpeg(ffmpegCommand)
    })
  })

  describe('With transcoding enabled on classic live', function () {
    let live: LiveVideo
    let video: Video
    let ffmpegCommand: FfmpegCommand
    let jobUUID: string
    let acceptedJob: RunnerJob & { jobToken: string }

    async function testPlaylistFile (fixture: string, expected: string) {
      const text = await server.streamingPlaylists.get({ url: `${baseUrl}/${video.uuid}/${fixture}` })
      expect(await readFile(buildAbsoluteFixturePath(expected), 'utf-8')).to.equal(text)

    }

    async function testTSFile (fixture: string, expected: string) {
      const { body } = await makeRawRequest({ url: `${baseUrl}/${video.uuid}/${fixture}`, expectedStatus: HttpStatusCode.OK_200 })
      expect(await readFile(buildAbsoluteFixturePath(expected))).to.deep.equal(body)
    }

    before(async function () {
      await server.config.enableLive({
        allowReplay: true,
        resolutions: 'max',
        transcoding: true
      })
    })

    it('Should publish a a live and have available jobs', async function () {
      this.timeout(120000)

      const data = await server.live.quickCreate({ permanentLive: false, saveReplay: false, privacy: VideoPrivacy.PUBLIC })
      live = data.live
      video = data.video

      ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
      await waitJobs([ server ])

      const job = await server.runnerJobs.requestLiveJob(runnerToken)
      jobUUID = job.uuid

      expect(job.type).to.equal('live-rtmp-hls-transcoding')
      expect(job.payload.input.rtmpUrl).to.exist

      expect(job.payload.output.toTranscode).to.have.lengthOf(6)

      for (const { resolution, fps } of job.payload.output.toTranscode) {
        expect([ 720, 480, 360, 240, 144, 0 ]).to.contain(resolution)

        if (resolution === 0) {
          expect(fps).to.equal(0)
        } else {
          expect(fps).to.be.above(25)
          expect(fps).to.be.below(70)
        }
      }
    })

    it('Should update the live with a new chunk', async function () {
      this.timeout(120000)

      const { job } = await server.runnerJobs.accept<RunnerJobLiveRTMPHLSTranscodingPayload>({ jobUUID, runnerToken })
      acceptedJob = job

      {
        const payload: LiveRTMPHLSTranscodingUpdatePayload = {
          masterPlaylistFile: 'live/master.m3u8',
          resolutionPlaylistFile: 'live/0.m3u8',
          resolutionPlaylistFilename: '0.m3u8',
          type: 'add-chunk',
          videoChunkFile: 'live/0-000067.ts',
          videoChunkFilename: '0-000067.ts'
        }
        await server.runnerJobs.update({ jobUUID, runnerToken, jobToken: job.jobToken, payload, progress: 50 })

        const updatedJob = await server.runnerJobs.getJob({ uuid: job.uuid })
        expect(updatedJob.progress).to.equal(50)
      }

      {
        const payload: LiveRTMPHLSTranscodingUpdatePayload = {
          resolutionPlaylistFile: 'live/1.m3u8',
          resolutionPlaylistFilename: '1.m3u8',
          type: 'add-chunk',
          videoChunkFile: 'live/1-000068.ts',
          videoChunkFilename: '1-000068.ts'
        }
        await server.runnerJobs.update({ jobUUID, runnerToken, jobToken: job.jobToken, payload })
      }

      await wait(1000)

      await testPlaylistFile('master.m3u8', 'live/master.m3u8')
      await testPlaylistFile('0.m3u8', 'live/0.m3u8')
      await testPlaylistFile('1.m3u8', 'live/1.m3u8')

      await testTSFile('0-000067.ts', 'live/0-000067.ts')
      await testTSFile('1-000068.ts', 'live/1-000068.ts')
    })

    it('Should replace existing m3u8 on update', async function () {
      this.timeout(120000)

      const payload: LiveRTMPHLSTranscodingUpdatePayload = {
        masterPlaylistFile: 'live/1.m3u8',
        resolutionPlaylistFilename: '0.m3u8',
        resolutionPlaylistFile: 'live/1.m3u8',
        type: 'add-chunk',
        videoChunkFile: 'live/1-000069.ts',
        videoChunkFilename: '1-000068.ts'
      }
      await server.runnerJobs.update({ jobUUID, runnerToken, jobToken: acceptedJob.jobToken, payload })
      await wait(1000)

      await testPlaylistFile('master.m3u8', 'live/1.m3u8')
      await testPlaylistFile('0.m3u8', 'live/1.m3u8')
      await testTSFile('1-000068.ts', 'live/1-000069.ts')
    })

    it('Should update the live with removed chunks', async function () {
      this.timeout(120000)

      const payload: LiveRTMPHLSTranscodingUpdatePayload = {
        resolutionPlaylistFile: 'live/0.m3u8',
        resolutionPlaylistFilename: '0.m3u8',
        type: 'remove-chunk',
        videoChunkFilename: '1-000068.ts'
      }
      await server.runnerJobs.update({ jobUUID, runnerToken, jobToken: acceptedJob.jobToken, payload })

      await wait(1000)

      await server.streamingPlaylists.get({ url: `${baseUrl}/${video.uuid}/master.m3u8` })
      await server.streamingPlaylists.get({ url: `${baseUrl}/${video.uuid}/0.m3u8` })
      await server.streamingPlaylists.get({ url: `${baseUrl}/${video.uuid}/1.m3u8` })
      await makeRawRequest({ url: `${baseUrl}/${video.uuid}/0-000067.ts`, expectedStatus: HttpStatusCode.OK_200 })
      await makeRawRequest({ url: `${baseUrl}/${video.uuid}/1-000068.ts`, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should complete the live and save the replay', async function () {
      this.timeout(120000)

      for (const segment of [ '0-000069.ts', '0-000070.ts' ]) {
        const payload: LiveRTMPHLSTranscodingUpdatePayload = {
          masterPlaylistFile: 'live/master.m3u8',
          resolutionPlaylistFilename: '0.m3u8',
          resolutionPlaylistFile: 'live/0.m3u8',
          type: 'add-chunk',
          videoChunkFile: 'live/' + segment,
          videoChunkFilename: segment
        }
        await server.runnerJobs.update({ jobUUID, runnerToken, jobToken: acceptedJob.jobToken, payload })

        await wait(1000)
      }

      await waitJobs([ server ])

      {
        const { state } = await server.videos.get({ id: video.uuid })
        expect(state.id).to.equal(VideoState.PUBLISHED)
      }

      await stopFfmpeg(ffmpegCommand)

      await server.runnerJobs.success({ jobUUID, runnerToken, jobToken: acceptedJob.jobToken, payload: {} })

      await wait(1500)
      await waitJobs([ server ])

      {
        const { state } = await server.videos.get({ id: video.uuid })
        expect(state.id).to.equal(VideoState.LIVE_ENDED)

        const session = await server.live.findLatestSession({ videoId: video.uuid })
        expect(session.error).to.be.null
      }
    })
  })

  describe('With transcoding enabled on cancelled/aborted/errored live', function () {
    let live: LiveVideo
    let video: Video
    let ffmpegCommand: FfmpegCommand

    async function prepare () {
      ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
      await server.runnerJobs.requestLiveJob(runnerToken)

      const { job } = await server.runnerJobs.autoAccept({ runnerToken, type: 'live-rtmp-hls-transcoding' })

      return job
    }

    async function checkSessionError (error: LiveVideoErrorType) {
      await wait(1500)
      await waitJobs([ server ])

      const session = await server.live.findLatestSession({ videoId: video.uuid })
      expect(session.error).to.equal(error)
    }

    before(async function () {
      await server.config.enableLive({
        allowReplay: true,
        resolutions: 'max',
        transcoding: true
      })

      const data = await server.live.quickCreate({ permanentLive: true, saveReplay: false, privacy: VideoPrivacy.PUBLIC })
      live = data.live
      video = data.video
    })

    it('Should abort a running live', async function () {
      this.timeout(120000)

      const job = await prepare()

      await Promise.all([
        server.runnerJobs.abort({ jobUUID: job.uuid, runnerToken, jobToken: job.jobToken, reason: 'abort' }),
        testFfmpegStreamError(ffmpegCommand, true)
      ])

      // Abort is not supported
      await checkSessionError(LiveVideoError.RUNNER_JOB_ERROR)
    })

    it('Should cancel a running live', async function () {
      this.timeout(120000)

      const job = await prepare()

      await Promise.all([
        server.runnerJobs.cancelByAdmin({ jobUUID: job.uuid }),
        testFfmpegStreamError(ffmpegCommand, true)
      ])

      await checkSessionError(LiveVideoError.RUNNER_JOB_CANCEL)
    })

    it('Should error a running live', async function () {
      this.timeout(120000)

      const job = await prepare()

      await Promise.all([
        server.runnerJobs.error({ jobUUID: job.uuid, runnerToken, jobToken: job.jobToken, message: 'error' }),
        testFfmpegStreamError(ffmpegCommand, true)
      ])

      await checkSessionError(LiveVideoError.RUNNER_JOB_ERROR)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
