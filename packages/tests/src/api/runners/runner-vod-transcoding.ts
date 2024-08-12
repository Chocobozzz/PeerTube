/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { readFile } from 'fs/promises'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  HttpStatusCode,
  RunnerJobSuccessPayload,
  RunnerJobVODAudioMergeTranscodingPayload,
  RunnerJobVODHLSTranscodingPayload,
  RunnerJobVODPayload,
  RunnerJobVODWebVideoTranscodingPayload,
  VideoState,
  VODAudioMergeTranscodingSuccess,
  VODHLSTranscodingSuccess,
  VODWebVideoTranscodingSuccess
} from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'

async function processAllJobs (server: PeerTubeServer, runnerToken: string) {
  do {
    const { availableJobs } = await server.runnerJobs.requestVOD({ runnerToken })
    if (availableJobs.length === 0) break

    const { job } = await server.runnerJobs.accept<RunnerJobVODPayload>({ runnerToken, jobUUID: availableJobs[0].uuid })

    const payload: RunnerJobSuccessPayload = {
      videoFile: `video_short_${job.payload.output.resolution}p.mp4`,
      resolutionPlaylistFile: `video_short_${job.payload.output.resolution}p.m3u8`
    }
    await server.runnerJobs.success({ runnerToken, jobUUID: job.uuid, jobToken: job.jobToken, payload })
  } while (true)

  await waitJobs([ server ])
}

describe('Test runner VOD transcoding', function () {
  let servers: PeerTubeServer[] = []
  let runnerToken: string

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableRemoteTranscoding()
    runnerToken = await servers[0].runners.autoRegisterRunner()
  })

  describe('Without transcoding', function () {

    before(async function () {
      this.timeout(60000)

      await servers[0].config.disableTranscoding()
      await servers[0].videos.quickUpload({ name: 'video' })

      await waitJobs(servers)
    })

    it('Should not have available jobs', async function () {
      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })
      expect(availableJobs).to.have.lengthOf(0)
    })
  })

  describe('With classic transcoding enabled', function () {

    before(async function () {
      this.timeout(60000)

      await servers[0].config.enableTranscoding({ hls: true, webVideo: true, resolutions: 'max' })
    })

    it('Should error a transcoding job', async function () {
      this.timeout(60000)

      await servers[0].runnerJobs.cancelAllJobs()
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      await waitJobs(servers)

      const { availableJobs } = await servers[0].runnerJobs.request({ runnerToken })
      const jobUUID = availableJobs[0].uuid

      for (let i = 0; i < 5; i++) {
        const { job } = await servers[0].runnerJobs.accept({ runnerToken, jobUUID })
        const jobToken = job.jobToken

        await servers[0].runnerJobs.error({ runnerToken, jobUUID, jobToken, message: 'Error' })
      }

      const video = await servers[0].videos.get({ id: uuid })
      expect(video.state.id).to.equal(VideoState.TRANSCODING_FAILED)
    })

    it('Should cancel a transcoding job', async function () {
      await servers[0].runnerJobs.cancelAllJobs()

      await servers[0].config.enableTranscoding({ hls: true, webVideo: false })
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      await waitJobs(servers)

      const { availableJobs } = await servers[0].runnerJobs.request({ runnerToken })
      const jobUUID = availableJobs[0].uuid

      await servers[0].runnerJobs.cancelByAdmin({ jobUUID })

      const video = await servers[0].videos.get({ id: uuid })
      expect(video.state.id).to.equal(VideoState.PUBLISHED)
    })
  })

  describe('Web video transcoding only', function () {
    let videoUUID: string
    let jobToken: string
    let jobUUID: string

    before(async function () {
      this.timeout(60000)

      await servers[0].runnerJobs.cancelAllJobs()
      await servers[0].config.enableTranscoding({ hls: false, webVideo: true })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'web video', fixture: 'video_short.webm' })
      videoUUID = uuid

      await waitJobs(servers)
    })

    it('Should have jobs available for remote runners', async function () {
      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })
      expect(availableJobs).to.have.lengthOf(1)

      jobUUID = availableJobs[0].uuid
    })

    it('Should have a valid first transcoding job', async function () {
      const { job } = await servers[0].runnerJobs.accept<RunnerJobVODWebVideoTranscodingPayload>({ runnerToken, jobUUID })
      jobToken = job.jobToken

      expect(job.type === 'vod-web-video-transcoding')
      expect(job.payload.input.videoFileUrl).to.exist
      expect(job.payload.output.resolution).to.equal(720)
      expect(job.payload.output.fps).to.equal(25)

      const { body } = await servers[0].runnerJobs.getJobFile({ url: job.payload.input.videoFileUrl, jobToken, runnerToken })
      const inputFile = await readFile(buildAbsoluteFixturePath('video_short.webm'))

      expect(body).to.deep.equal(inputFile)
    })

    it('Should transcode the max video resolution and send it back to the server', async function () {
      this.timeout(60000)

      const payload: VODWebVideoTranscodingSuccess = {
        videoFile: 'video_short.mp4'
      }
      await servers[0].runnerJobs.success({ runnerToken, jobUUID, jobToken, payload })

      await waitJobs(servers)
    })

    it('Should have the video updated', async function () {
      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })
        expect(video.files).to.have.lengthOf(1)
        expect(video.streamingPlaylists).to.have.lengthOf(0)

        const { body } = await makeRawRequest({ url: video.files[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        expect(body).to.deep.equal(await readFile(buildAbsoluteFixturePath('video_short.mp4')))
      }
    })

    it('Should have 4 lower resolution to transcode', async function () {
      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })
      expect(availableJobs).to.have.lengthOf(4)

      for (const resolution of [ 480, 360, 240, 144 ]) {
        const job = availableJobs.find(j => j.payload.output.resolution === resolution)
        expect(job).to.exist
        expect(job.type).to.equal('vod-web-video-transcoding')

        if (resolution === 240) jobUUID = job.uuid
      }
    })

    it('Should process one of these transcoding jobs', async function () {
      const { job } = await servers[0].runnerJobs.accept<RunnerJobVODWebVideoTranscodingPayload>({ runnerToken, jobUUID })
      jobToken = job.jobToken

      const { body } = await servers[0].runnerJobs.getJobFile({ url: job.payload.input.videoFileUrl, jobToken, runnerToken })
      const inputFile = await readFile(buildAbsoluteFixturePath('video_short.mp4'))

      expect(body).to.deep.equal(inputFile)

      const payload: VODWebVideoTranscodingSuccess = { videoFile: `video_short_${job.payload.output.resolution}p.mp4` }
      await servers[0].runnerJobs.success({ runnerToken, jobUUID, jobToken, payload })
    })

    it('Should process all other jobs', async function () {
      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })
      expect(availableJobs).to.have.lengthOf(3)

      for (const resolution of [ 480, 360, 144 ]) {
        const availableJob = availableJobs.find(j => j.payload.output.resolution === resolution)
        expect(availableJob).to.exist
        jobUUID = availableJob.uuid

        const { job } = await servers[0].runnerJobs.accept<RunnerJobVODWebVideoTranscodingPayload>({ runnerToken, jobUUID })
        jobToken = job.jobToken

        const { body } = await servers[0].runnerJobs.getJobFile({ url: job.payload.input.videoFileUrl, jobToken, runnerToken })
        const inputFile = await readFile(buildAbsoluteFixturePath('video_short.mp4'))
        expect(body).to.deep.equal(inputFile)

        const payload: VODWebVideoTranscodingSuccess = { videoFile: `video_short_${resolution}p.mp4` }
        await servers[0].runnerJobs.success({ runnerToken, jobUUID, jobToken, payload })
      }

      await waitJobs(servers)
    })

    it('Should have the video updated', async function () {
      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })
        expect(video.files).to.have.lengthOf(5)
        expect(video.streamingPlaylists).to.have.lengthOf(0)

        const { body } = await makeRawRequest({ url: video.files[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        expect(body).to.deep.equal(await readFile(buildAbsoluteFixturePath('video_short.mp4')))

        for (const file of video.files) {
          await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
          await makeRawRequest({ url: file.torrentUrl, expectedStatus: HttpStatusCode.OK_200 })
        }
      }
    })

    it('Should not have available jobs anymore', async function () {
      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })
      expect(availableJobs).to.have.lengthOf(0)
    })
  })

  describe('HLS transcoding only', function () {
    let videoUUID: string
    let jobToken: string
    let jobUUID: string

    before(async function () {
      this.timeout(60000)

      await servers[0].config.enableTranscoding({ hls: true, webVideo: false })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'hls video', fixture: 'video_short.webm' })
      videoUUID = uuid

      await waitJobs(servers)
    })

    it('Should run the optimize job', async function () {
      this.timeout(60000)

      await servers[0].runnerJobs.autoProcessWebVideoJob(runnerToken)
    })

    it('Should have 5 HLS resolution to transcode', async function () {
      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })
      expect(availableJobs).to.have.lengthOf(5)

      for (const resolution of [ 720, 480, 360, 240, 144 ]) {
        const job = availableJobs.find(j => j.payload.output.resolution === resolution)
        expect(job).to.exist
        expect(job.type).to.equal('vod-hls-transcoding')

        if (resolution === 480) jobUUID = job.uuid
      }
    })

    it('Should process one of these transcoding jobs', async function () {
      this.timeout(60000)

      const { job } = await servers[0].runnerJobs.accept<RunnerJobVODHLSTranscodingPayload>({ runnerToken, jobUUID })
      jobToken = job.jobToken

      const { body } = await servers[0].runnerJobs.getJobFile({ url: job.payload.input.videoFileUrl, jobToken, runnerToken })
      const inputFile = await readFile(buildAbsoluteFixturePath('video_short.mp4'))

      expect(body).to.deep.equal(inputFile)

      const payload: VODHLSTranscodingSuccess = {
        videoFile: 'video_short_480p.mp4',
        resolutionPlaylistFile: 'video_short_480p.m3u8'
      }
      await servers[0].runnerJobs.success({ runnerToken, jobUUID, jobToken, payload })

      await waitJobs(servers)
    })

    it('Should have the video updated', async function () {
      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })

        expect(video.files).to.have.lengthOf(1)
        expect(video.streamingPlaylists).to.have.lengthOf(1)

        const hls = video.streamingPlaylists[0]
        expect(hls.files).to.have.lengthOf(1)

        await completeCheckHlsPlaylist({ videoUUID, hlsOnly: false, servers, resolutions: [ 480 ] })
      }
    })

    it('Should process all other jobs', async function () {
      this.timeout(60000)

      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })
      expect(availableJobs).to.have.lengthOf(4)

      let maxQualityFile = 'video_short.mp4'

      for (const resolution of [ 720, 360, 240, 144 ]) {
        const availableJob = availableJobs.find(j => j.payload.output.resolution === resolution)
        expect(availableJob).to.exist
        jobUUID = availableJob.uuid

        const { job } = await servers[0].runnerJobs.accept<RunnerJobVODHLSTranscodingPayload>({ runnerToken, jobUUID })
        jobToken = job.jobToken

        const { body } = await servers[0].runnerJobs.getJobFile({ url: job.payload.input.videoFileUrl, jobToken, runnerToken })
        const inputFile = await readFile(buildAbsoluteFixturePath(maxQualityFile))
        expect(body).to.deep.equal(inputFile)

        const payload: VODHLSTranscodingSuccess = {
          videoFile: `video_short_${resolution}p.mp4`,
          resolutionPlaylistFile: `video_short_${resolution}p.m3u8`
        }
        await servers[0].runnerJobs.success({ runnerToken, jobUUID, jobToken, payload })

        if (resolution === 720) {
          maxQualityFile = 'video_short_720p.mp4'
        }
      }

      await waitJobs(servers)
    })

    it('Should have the video updated', async function () {
      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })

        expect(video.files).to.have.lengthOf(0)
        expect(video.streamingPlaylists).to.have.lengthOf(1)

        const hls = video.streamingPlaylists[0]
        expect(hls.files).to.have.lengthOf(5)

        await completeCheckHlsPlaylist({ videoUUID, hlsOnly: true, servers, resolutions: [ 720, 480, 360, 240, 144 ] })
      }
    })

    it('Should not have available jobs anymore', async function () {
      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })
      expect(availableJobs).to.have.lengthOf(0)
    })
  })

  describe('Web video and HLS transcoding', function () {

    before(async function () {
      this.timeout(60000)

      await servers[0].config.enableTranscoding({ hls: true, webVideo: true })

      await servers[0].videos.quickUpload({ name: 'web video and hls video', fixture: 'video_short.webm' })

      await waitJobs(servers)
    })

    it('Should process the first optimize job', async function () {
      this.timeout(60000)

      await servers[0].runnerJobs.autoProcessWebVideoJob(runnerToken)
    })

    it('Should have 5 jobs to process', async function () {
      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })

      expect(availableJobs).to.have.lengthOf(5)

      const webVideoJobs = availableJobs.filter(j => j.type === 'vod-web-video-transcoding')

      // Other HLS resolution jobs needs to web video transcoding to be processed first
      const hlsJobs = availableJobs.filter(j => j.type === 'vod-hls-transcoding')

      expect(webVideoJobs).to.have.lengthOf(4)
      expect(hlsJobs).to.have.lengthOf(1)
    })

    it('Should process all available jobs', async function () {
      await processAllJobs(servers[0], runnerToken)
    })
  })

  describe('Audio merge transcoding', function () {
    let videoUUID: string
    let jobToken: string
    let jobUUID: string

    before(async function () {
      this.timeout(60000)

      await servers[0].config.enableTranscoding({ hls: true, webVideo: true })

      const attributes = { name: 'audio_with_preview', previewfile: 'custom-preview.jpg', fixture: 'sample.ogg' }
      const { uuid } = await servers[0].videos.upload({ attributes, mode: 'legacy' })
      videoUUID = uuid

      await waitJobs(servers)
    })

    it('Should have an audio merge transcoding job', async function () {
      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })
      expect(availableJobs).to.have.lengthOf(1)

      expect(availableJobs[0].type).to.equal('vod-audio-merge-transcoding')

      jobUUID = availableJobs[0].uuid
    })

    it('Should have a valid remote audio merge transcoding job', async function () {
      const { job } = await servers[0].runnerJobs.accept<RunnerJobVODAudioMergeTranscodingPayload>({ runnerToken, jobUUID })
      jobToken = job.jobToken

      expect(job.type === 'vod-audio-merge-transcoding')
      expect(job.payload.input.audioFileUrl).to.exist
      expect(job.payload.input.previewFileUrl).to.exist
      expect(job.payload.output.resolution).to.equal(480)

      {
        const { body } = await servers[0].runnerJobs.getJobFile({ url: job.payload.input.audioFileUrl, jobToken, runnerToken })
        const inputFile = await readFile(buildAbsoluteFixturePath('sample.ogg'))
        expect(body).to.deep.equal(inputFile)
      }

      {
        const { body } = await servers[0].runnerJobs.getJobFile({ url: job.payload.input.previewFileUrl, jobToken, runnerToken })

        const video = await servers[0].videos.get({ id: videoUUID })
        const { body: inputFile } = await makeGetRequest({
          url: servers[0].url,
          path: video.previewPath,
          expectedStatus: HttpStatusCode.OK_200
        })

        expect(body).to.deep.equal(inputFile)
      }
    })

    it('Should merge the audio', async function () {
      this.timeout(60000)

      const payload: VODAudioMergeTranscodingSuccess = { videoFile: 'video_short_480p.mp4' }
      await servers[0].runnerJobs.success({ runnerToken, jobUUID, jobToken, payload })

      await waitJobs(servers)
    })

    it('Should have the video updated', async function () {
      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })
        expect(video.files).to.have.lengthOf(1)
        expect(video.streamingPlaylists).to.have.lengthOf(0)

        const { body } = await makeRawRequest({ url: video.files[0].fileUrl, expectedStatus: HttpStatusCode.OK_200 })
        expect(body).to.deep.equal(await readFile(buildAbsoluteFixturePath('video_short_480p.mp4')))
      }
    })

    it('Should have 4 lower resolutions to transcode', async function () {
      const { availableJobs } = await servers[0].runnerJobs.requestVOD({ runnerToken })
      expect(availableJobs).to.have.lengthOf(4)

      for (const resolution of [ 360, 240, 144 ]) {
        const jobs = availableJobs.filter(j => j.payload.output.resolution === resolution)
        expect(jobs).to.have.lengthOf(1)
      }

      jobUUID = availableJobs.find(j => j.payload.output.resolution === 480).uuid
    })

    it('Should process one other job', async function () {
      this.timeout(60000)

      const { job } = await servers[0].runnerJobs.accept<RunnerJobVODHLSTranscodingPayload>({ runnerToken, jobUUID })
      jobToken = job.jobToken

      const { body } = await servers[0].runnerJobs.getJobFile({ url: job.payload.input.videoFileUrl, jobToken, runnerToken })
      const inputFile = await readFile(buildAbsoluteFixturePath('video_short_480p.mp4'))
      expect(body).to.deep.equal(inputFile)

      const payload: VODHLSTranscodingSuccess = {
        videoFile: `video_short_480p.mp4`,
        resolutionPlaylistFile: `video_short_480p.m3u8`
      }
      await servers[0].runnerJobs.success({ runnerToken, jobUUID, jobToken, payload })

      await waitJobs(servers)
    })

    it('Should have the video updated', async function () {
      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })

        expect(video.files).to.have.lengthOf(1)
        expect(video.streamingPlaylists).to.have.lengthOf(1)

        const hls = video.streamingPlaylists[0]
        expect(hls.files).to.have.lengthOf(1)

        await completeCheckHlsPlaylist({ videoUUID, hlsOnly: false, servers, resolutions: [ 480 ] })
      }
    })

    it('Should process all available jobs', async function () {
      await processAllJobs(servers[0], runnerToken)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
