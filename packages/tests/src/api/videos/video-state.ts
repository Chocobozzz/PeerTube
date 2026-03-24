/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */
import { sortBy } from '@peertube/peertube-core-utils'
import { MoveVideoStoragePayload, VideoState, VideoTranscodingPayload } from '@peertube/peertube-models'
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
import { expect } from 'chai'

describe('Test video state on local job queue', function () {
  let servers: PeerTubeServer[] = []
  const resolutions = [ 720, 240, 144 ]

  async function prepareVideo () {
    const { uuid } = await servers[0].videos.quickUpload({ name: 'video', fixture: 'video_short.mp4' })
    await waitJobs(servers)

    return uuid
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[0].config.setTranscodingConcurrency(1)
  })

  describe('Without object storage', function () {
    async function checkPublication (options: {
      uuid: string
      publishedJobFinder: (data: VideoTranscodingPayload) => boolean
    }) {
      const { uuid, publishedJobFinder } = options

      const { data } = await servers[0].jobs.list({ jobType: 'video-transcoding' })
      const publishedJob = data.find(j => {
        const data = j.data as VideoTranscodingPayload

        return data.videoUUID === uuid && publishedJobFinder(data)
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

    async function checkJobOrder (options: {
      uuid: string
      order: { type: VideoTranscodingPayload['type'], resolution?: number }[]
    }) {
      const { uuid, order } = options

      const { data } = await servers[0].jobs.list({ jobType: 'video-transcoding' })

      const jobs = sortBy(data.filter(j => (j.data as VideoTranscodingPayload).videoUUID === uuid), 'processedOn')
        .map(j => {
          const data = j.data as VideoTranscodingPayload

          if (data.type === 'optimize-to-web-video') return { type: data.type }

          return { type: data.type, resolution: data.resolution }
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
        publishedJobFinder: data => data.type === 'optimize-to-web-video'
      })

      await checkJobOrder({
        uuid,
        order: [ { type: 'optimize-to-web-video' } ]
      })
    })

    it('Should publish after web video transcoding only, when the first child resolution job ends', async function () {
      await servers[0].config.enableTranscoding({ hls: false, webVideo: true, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: data => data.type === 'new-resolution-to-web-video' && data.resolution === 240
      })

      await checkJobOrder({
        uuid,
        order: [
          { type: 'optimize-to-web-video' },
          { type: 'new-resolution-to-web-video', resolution: 240 },
          { type: 'new-resolution-to-web-video', resolution: 144 }
        ]
      })
    })

    it('Should publish after web & hls transcodings, when the max HLS resolution ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: true, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: data => data.type === 'new-resolution-to-hls' && data.resolution === 720
      })

      await checkJobOrder({
        uuid,
        order: [
          { type: 'optimize-to-web-video' },
          { type: 'new-resolution-to-hls', resolution: 720 },
          { type: 'new-resolution-to-web-video', resolution: 240 },
          { type: 'new-resolution-to-web-video', resolution: 144 },
          { type: 'new-resolution-to-hls', resolution: 240 },
          { type: 'new-resolution-to-hls', resolution: 144 }
        ]
      })
    })

    it('Should publish after HLS transcoding only, when the first child resolution job ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions: [] })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: data => data.type === 'new-resolution-to-hls' && data.resolution === 720
      })

      await checkJobOrder({
        uuid,
        order: [
          { type: 'optimize-to-web-video' },
          { type: 'new-resolution-to-hls', resolution: 720 }
        ]
      })
    })

    it('Should publish after hls transcoding only, when the max HLS resolution ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: data => data.type === 'new-resolution-to-hls' && data.resolution === 720
      })

      await checkJobOrder({
        uuid,
        order: [
          { type: 'optimize-to-web-video' },
          { type: 'new-resolution-to-hls', resolution: 720 },
          { type: 'new-resolution-to-hls', resolution: 240 },
          { type: 'new-resolution-to-hls', resolution: 144 }
        ]
      })
    })

    it('Should publish after hls transcoding only with audio and video splitted, when audio & video streams are ready', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions, splitAudioAndVideo: true })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: data => data.type === 'new-resolution-to-hls' && data.resolution === 0
      })

      await checkJobOrder({
        uuid,
        order: [
          { type: 'optimize-to-web-video' },
          { type: 'new-resolution-to-hls', resolution: 720 },
          { type: 'new-resolution-to-hls', resolution: 0 },
          { type: 'new-resolution-to-hls', resolution: 240 },
          { type: 'new-resolution-to-hls', resolution: 144 }
        ]
      })
    })
  })

  describe('With object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    async function checkPublication (options: {
      uuid: string
      publishedJobFinder: (data: VideoTranscodingPayload) => boolean
    }) {
      const { uuid, publishedJobFinder } = options

      const { data: transcodingJobs } = await servers[0].jobs.list({ jobType: 'video-transcoding' })
      const transcodingJob = transcodingJobs.find(j => {
        const data = j.data as VideoTranscodingPayload

        return data.videoUUID === uuid && publishedJobFinder(data)
      })

      // Video is published in the next move to object storage job
      const { data: objectStorageJobs } = await servers[0].jobs.list({ jobType: 'move-to-object-storage', sort: 'createdAt', count: 100 })
      const publishedJob = objectStorageJobs.find(j => {
        const data = j.data as MoveVideoStoragePayload

        return data.videoUUID === uuid && new Date(j.processedOn) > new Date(transcodingJob.processedOn)
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
        publishedJobFinder: data => data.type === 'optimize-to-web-video'
      })
    })

    it('Should publish after web video transcoding only, when the first child resolution job ends', async function () {
      await servers[0].config.enableTranscoding({ hls: false, webVideo: true, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: data => data.type === 'new-resolution-to-web-video' && data.resolution === 240
      })
    })

    it('Should publish after web & hls transcodings, when the max HLS resolution ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: true, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: data => data.type === 'new-resolution-to-hls' && data.resolution === 720
      })
    })

    it('Should publish after HLS transcoding only, when the first child resolution job ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions: [] })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: data => data.type === 'new-resolution-to-hls' && data.resolution === 720
      })
    })

    it('Should publish after hls transcoding only, when the max HLS resolution ends', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: data => data.type === 'new-resolution-to-hls' && data.resolution === 720
      })
    })

    it('Should publish after hls transcoding only with audio and video splitted, when audio & video streams are ready', async function () {
      await servers[0].config.enableTranscoding({ hls: true, webVideo: false, resolutions, splitAudioAndVideo: true })
      const uuid = await prepareVideo()

      await checkPublication({
        uuid,
        publishedJobFinder: data => data.type === 'new-resolution-to-hls' && data.resolution === 0
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
