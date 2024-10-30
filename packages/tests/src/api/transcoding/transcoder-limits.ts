/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getAllFiles, getMaxTheoreticalBitrate, getMinTheoreticalBitrate } from '@peertube/peertube-core-utils'
import {
  getVideoStreamBitrate,
  getVideoStreamDimensionsInfo,
  getVideoStreamFPS
} from '@peertube/peertube-ffmpeg'
import { VideoResolution } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { generateHighBitrateVideo, generateVideoWithFramerate } from '@tests/shared/generate.js'
import { expect } from 'chai'

describe('Test video transcoding limits', function () {
  let servers: PeerTubeServer[] = []

  before(async function () {
    this.timeout(30_000)

    // Run servers
    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[1].config.enableTranscoding({
      alwaysTranscodeOriginalResolution: true,
      hls: true,
      webVideo: true,
      resolutions: 'max',
      with0p: false
    })
  })

  describe('Framerate limits', function () {

    async function testFPS (uuid: string, originFPS: number, averageFPS: number) {
      for (const server of servers) {
        const video = await server.videos.get({ id: uuid })

        const files = video.files
        const originalFile = files[0]

        expect(originalFile.fps).to.be.closeTo(originFPS, 2)
        const path = servers[1].servers.buildWebVideoFilePath(originalFile.fileUrl)
        expect(await getVideoStreamFPS(path)).to.be.closeTo(originFPS, 2)

        files.shift()

        for (const file of files) {
          expect(file.fps).to.be.closeTo(averageFPS, 2)

          const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)
          expect(await getVideoStreamFPS(path)).to.be.closeTo(averageFPS, 2)
        }
      }
    }

    function updateMaxFPS (value: number) {
      return servers[1].config.updateExistingConfig({
        newConfig: {
          transcoding: {
            fps: { max: value }
          }
        }
      })
    }

    it('Should transcode a 60 FPS video', async function () {
      this.timeout(60_000)

      const attributes = { name: '60fps server 2', fixture: '60fps_720p_small.mp4' }
      const { uuid } = await servers[1].videos.upload({ attributes })
      await waitJobs(servers)

      await testFPS(uuid, 60, 30)
    })

    it('Should transcode origin resolution to max FPS', async function () {
      this.timeout(360_000)

      let tempFixturePath: string

      {
        tempFixturePath = await generateVideoWithFramerate(50, '480x270')

        const fps = await getVideoStreamFPS(tempFixturePath)
        expect(fps).to.be.equal(50)
      }

      {
        const attributes = { name: '50fps', fixture: tempFixturePath }
        const { uuid } = await servers[1].videos.upload({ attributes })

        await waitJobs(servers)
        await testFPS(uuid, 50, 25)
      }
    })

    it('Should downscale to the closest divisor standard framerate', async function () {
      this.timeout(360_000)

      let tempFixturePath: string

      {
        tempFixturePath = await generateVideoWithFramerate(59)

        const fps = await getVideoStreamFPS(tempFixturePath)
        expect(fps).to.be.equal(59)
      }

      const attributes = { name: '59fps video', fixture: tempFixturePath }
      const { uuid } = await servers[1].videos.upload({ attributes })

      await waitJobs(servers)
      await testFPS(uuid, 59, 25)
    })

    it('Should configure max FPS', async function () {
      this.timeout(120_000)

      await updateMaxFPS(15)

      const attributes = { name: 'capped 15fps', fixture: '60fps_720p_small.mp4' }
      const { uuid } = await servers[1].videos.upload({ attributes })

      await waitJobs(servers)
      await testFPS(uuid, 15, 15)
    })

    it('Should not duplicate resolution on re-transcoding', async function () {
      this.timeout(120_000)

      await updateMaxFPS(50)

      const attributes = { name: 'capped 50fps', fixture: '60fps_720p_small.mp4' }
      const { uuid } = await servers[1].videos.upload({ attributes })

      await waitJobs(servers)
      await testFPS(uuid, 50, 25)

      await servers[1].videos.runTranscoding({ transcodingType: 'web-video', videoId: uuid })
      await waitJobs(servers)

      const video = await servers[1].videos.get({ id: uuid })
      expect(video.files.map(f => f.resolution.id)).to.deep.equal([ 720, 480, 360, 240, 144 ])

      await testFPS(uuid, 50, 25)
    })

    after(async function () {
      await updateMaxFPS(60)
    })
  })

  describe('Bitrate control', function () {

    it('Should respect maximum bitrate values', async function () {
      this.timeout(160_000)

      const tempFixturePath = await generateHighBitrateVideo()

      const attributes = {
        name: 'high bitrate video',
        description: 'high bitrate video',
        fixture: tempFixturePath
      }

      await servers[1].videos.upload({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        const { id } = data.find(v => v.name === attributes.name)
        const video = await server.videos.get({ id })

        for (const resolution of [ 240, 360, 480, 720, 1080 ]) {
          const file = video.files.find(f => f.resolution.id === resolution)
          const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)

          const bitrate = await getVideoStreamBitrate(path)
          const fps = await getVideoStreamFPS(path)
          const dataResolution = await getVideoStreamDimensionsInfo(path)

          expect(resolution).to.equal(resolution)

          const maxBitrate = getMaxTheoreticalBitrate({ ...dataResolution, fps })
          expect(bitrate).to.be.below(maxBitrate)
        }
      }
    })

    it('Should not transcode to an higher bitrate than the original file but above our low limit', async function () {
      this.timeout(160_000)

      const newConfig = {
        transcoding: {
          enabled: true,
          resolutions: {
            '144p': true,
            '240p': true,
            '360p': true,
            '480p': true,
            '720p': true,
            '1080p': true,
            '1440p': true,
            '2160p': true
          },
          webVideos: { enabled: true },
          hls: { enabled: true }
        }
      }
      await servers[1].config.updateExistingConfig({ newConfig })

      const attributes = {
        name: 'low bitrate',
        fixture: 'low-bitrate.mp4'
      }

      const { id } = await servers[1].videos.upload({ attributes })

      await waitJobs(servers)

      const video = await servers[1].videos.get({ id })

      const resolutions = [ 240, 360, 480, 720, 1080 ]
      for (const r of resolutions) {
        const file = video.files.find(f => f.resolution.id === r)

        const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)
        const bitrate = await getVideoStreamBitrate(path)

        const inputBitrate = 60_000
        const limit = getMinTheoreticalBitrate({ fps: 10, ratio: 1, resolution: r })
        let belowValue = Math.max(inputBitrate, limit)
        belowValue += belowValue * 0.20 // Apply 20% margin because bitrate control is not very precise

        expect(bitrate, `${path} not below ${limit}`).to.be.below(belowValue)
      }
    })
  })

  describe('Resolution capping', function () {

    it('Should not generate an upper resolution than original file', async function () {
      this.timeout(120_000)

      await servers[0].config.enableTranscoding({
        resolutions: [ VideoResolution.H_240P, VideoResolution.H_480P ],
        alwaysTranscodeOriginalResolution: false
      })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video', fixture: 'video_short.webm' })
      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      const hlsFiles = video.streamingPlaylists[0].files

      expect(video.files).to.have.lengthOf(2)
      expect(hlsFiles).to.have.lengthOf(2)

      const resolutions = getAllFiles(video).map(f => f.resolution.id)
      expect(resolutions).to.have.members([ 240, 240, 480, 480 ])
    })

    it('Should only keep the original resolution if all resolutions are disabled', async function () {
      this.timeout(120_000)

      await servers[0].config.enableTranscoding({ resolutions: [] })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video', fixture: 'video_short.webm' })
      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      const hlsFiles = video.streamingPlaylists[0].files

      expect(video.files).to.have.lengthOf(1)
      expect(hlsFiles).to.have.lengthOf(1)

      expect(video.files[0].resolution.id).to.equal(720)
      expect(hlsFiles[0].resolution.id).to.equal(720)
    })

    it('Should keep input resolution if only upper resolutions are enabled', async function () {
      this.timeout(120_000)

      await servers[0].config.enableTranscoding({ resolutions: [ 0, 1080 ], keepOriginal: false })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video', fixture: 'video_short.webm' })
      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      const hlsFiles = video.streamingPlaylists[0].files

      expect(video.files).to.have.lengthOf(2)
      expect(hlsFiles).to.have.lengthOf(2)

      expect(getAllFiles(video).map(f => f.resolution.id)).to.have.members([ 720, 720, 0, 0 ])
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
