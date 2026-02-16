/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { sortBy } from '@peertube/peertube-core-utils'
import { MoveVideoStoragePayload, RunnerJobType, RunnerJobVODPayload, VideoState } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  ObjectStorageCommand,
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { PeerTubeRunnerProcess } from '@tests/shared/peertube-runner-process.js'
import { expect } from 'chai'

describe('Test video state on peertube runners', function () {
  let servers: PeerTubeServer[] = []
  const resolutions = [ 720, 240, 144 ]
  let peertubeRunner: PeerTubeRunnerProcess
  const transcodingTypes = new Set<RunnerJobType>([ 'vod-audio-merge-transcoding', 'vod-hls-transcoding', 'vod-web-video-transcoding' ])

  async function prepareVideo () {
    const { uuid } = await servers[0].videos.quickUpload({ name: 'video', fixture: 'video_short.mp4' })
    await waitJobs(servers, { runnerJobs: true })

    return uuid
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    const registrationToken = await servers[0].runnerRegistrationTokens.getFirstRegistrationToken()

    peertubeRunner = new PeerTubeRunnerProcess(servers[0])
    await peertubeRunner.runServer()
    await peertubeRunner.registerPeerTubeInstance({ registrationToken, runnerName: 'runner' })

    await servers[0].config.setTranscodingConcurrency(1)
    await servers[0].config.enableRemoteTranscoding()
  })

  describe('Without object storage', function () {
    async function checkPublication (options: {
      uuid: string
      publishedJobFinder: (jobType: RunnerJobType, data: RunnerJobVODPayload) => boolean
    }) {
      const { uuid, publishedJobFinder } = options

      const { data } = await servers[0].runnerJobs.list({ count: 100 })
      const publishedJob = data
        .filter(j => transcodingTypes.has(j.type))
        .find(j => {
          return j.privatePayload.videoUUID === uuid && publishedJobFinder(j.type, j.payload as RunnerJobVODPayload)
        })

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })
        expect(video.state.id).to.equal(VideoState.PUBLISHED)

        expect(publishedJob.startedAt).to.exist
        expect(publishedJob.finishedAt).to.exist

        expect(new Date(video.publishedAt)).to.be.greaterThan(new Date(publishedJob.startedAt))
        expect(new Date(video.publishedAt)).to.be.below(new Date(publishedJob.finishedAt))
      }
    }

    async function checkJobOrder (options: {
      uuid: string
      order: { type: RunnerJobType, resolution: number }[]
    }) {
      const { uuid, order } = options

      const { data } = await servers[0].runnerJobs.list({ count: 100 })
      const filteredJobs = sortBy(data.filter(j => transcodingTypes.has(j.type) && j.privatePayload.videoUUID === uuid), 'startedAt')

      const jobs = filteredJobs.map(j => {
        return { type: j.type, resolution: (j.payload as RunnerJobVODPayload).output.resolution }
      })

      expect(jobs).to.deep.equal(order)
    }

    it('Should directly publish a video after upload without transcoding', async function () {
      await servers[0].config.disableTranscoding()

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })
        expect(video.state.id).to.equal(VideoState.PUBLISHED)
      }
    })

    it('Should publish after web video transcoding only, when the optimize job ends', async function () {
      await servers[0].config.enableTranscoding({ hls: false, webVideo: true, resolutions: [] })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-web-video-transcoding' && data.output.resolution === 720
      })

      await checkJobOrder({
        uuid,
        order: [ { type: 'vod-web-video-transcoding', resolution: 720 } ]
      })
    })

    it('Should publish after web video transcoding only, when the first child resolution job ends', async function () {
      await servers[0].config.enableTranscoding({ hls: false, webVideo: true, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-web-video-transcoding' && data.output.resolution === 240
      })

      await checkJobOrder({
        uuid,
        order: [
          { type: 'vod-web-video-transcoding', resolution: 720 },
          { type: 'vod-web-video-transcoding', resolution: 240 },
          { type: 'vod-web-video-transcoding', resolution: 144 }
        ]
      })
    })

    it('Should publish after web & hls transcodings, when the max HLS resolution ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: true, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-hls-transcoding' && data.output.resolution === 720
      })

      await checkJobOrder({
        uuid,
        order: [
          { type: 'vod-web-video-transcoding', resolution: 720 },
          { type: 'vod-hls-transcoding', resolution: 720 },
          { type: 'vod-web-video-transcoding', resolution: 240 },
          { type: 'vod-web-video-transcoding', resolution: 144 },
          { type: 'vod-hls-transcoding', resolution: 240 },
          { type: 'vod-hls-transcoding', resolution: 144 }
        ]
      })
    })

    it('Should publish after HLS transcoding only, when the first child resolution job ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions: [] })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-hls-transcoding' && data.output.resolution === 720
      })

      await checkJobOrder({
        uuid,
        order: [
          { type: 'vod-web-video-transcoding', resolution: 720 },
          { type: 'vod-hls-transcoding', resolution: 720 }
        ]
      })
    })

    it('Should publish after hls transcoding only, when the max HLS resolution ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-hls-transcoding' && data.output.resolution === 720
      })

      await checkJobOrder({
        uuid,
        order: [
          { type: 'vod-web-video-transcoding', resolution: 720 },
          { type: 'vod-hls-transcoding', resolution: 720 },
          { type: 'vod-hls-transcoding', resolution: 240 },
          { type: 'vod-hls-transcoding', resolution: 144 }
        ]
      })
    })

    it('Should publish after hls transcoding only with audio and video splitted, when audio & video streams are ready', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions, splitAudioAndVideo: true })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-hls-transcoding' && data.output.resolution === 0
      })

      await checkJobOrder({
        uuid,
        order: [
          { type: 'vod-web-video-transcoding', resolution: 720 },
          { type: 'vod-hls-transcoding', resolution: 720 },
          { type: 'vod-hls-transcoding', resolution: 0 },
          { type: 'vod-hls-transcoding', resolution: 240 },
          { type: 'vod-hls-transcoding', resolution: 144 }
        ]
      })
    })
  })

  describe('With object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    async function checkPublication (options: {
      uuid: string
      publishedJobFinder: (jobType: RunnerJobType, data: RunnerJobVODPayload) => boolean
    }) {
      const { uuid, publishedJobFinder } = options

      const { data } = await servers[0].runnerJobs.list({ count: 100 })
      const transcodingJob = data
        .filter(j => transcodingTypes.has(j.type))
        .find(j => {
          return j.privatePayload.videoUUID === uuid && publishedJobFinder(j.type, j.payload as RunnerJobVODPayload)
        })

      // Video is published in the next move to object storage job
      const { data: objectStorageJobs } = await servers[0].jobs.list({ jobType: 'move-to-object-storage', sort: 'createdAt', count: 100 })
      const publishedJob = objectStorageJobs.find(j => {
        const data = j.data as MoveVideoStoragePayload

        return data.videoUUID === uuid && new Date(j.processedOn) > new Date(transcodingJob.startedAt)
      })

      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })
        expect(video.state.id).to.equal(VideoState.PUBLISHED)

        expect(publishedJob.processedOn).to.exist
        expect(publishedJob.finishedOn).to.exist

        expect(new Date(video.publishedAt)).to.be.greaterThan(new Date(publishedJob.processedOn))
        expect(new Date(video.publishedAt)).to.be.below(new Date(publishedJob.finishedOn))
      }
    }

    before(async function () {
      await objectStorage.prepareDefaultMockBuckets()

      await servers[0].kill()
      await servers[0].run(objectStorage.getDefaultMockConfig())
    })

    it('Should publish after web video transcoding only, when the optimize job ends', async function () {
      await servers[0].config.enableTranscoding({ hls: false, webVideo: true, resolutions: [] })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-web-video-transcoding' && data.output.resolution === 720
      })
    })

    it('Should publish after web video transcoding only, when the first child resolution job ends', async function () {
      await servers[0].config.enableTranscoding({ hls: false, webVideo: true, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-web-video-transcoding' && data.output.resolution === 720
      })
    })

    it('Should publish after web & hls transcodings, when the max HLS resolution ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: true, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-web-video-transcoding' && data.output.resolution === 720
      })
    })

    it('Should publish after HLS transcoding only, when the first child resolution job ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions: [] })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-hls-transcoding' && data.output.resolution === 720
      })
    })

    it('Should publish after hls transcoding only, when the max HLS resolution ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-hls-transcoding' && data.output.resolution === 720
      })
    })

    it('Should publish after hls transcoding only with audio and video splitted, when audio & video streams are ready', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions, splitAudioAndVideo: true })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: (type, data) => type === 'vod-hls-transcoding' && data.output.resolution === 0
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
