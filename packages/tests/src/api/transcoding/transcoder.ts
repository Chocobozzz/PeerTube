/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { getAllFiles, getMaxTheoreticalBitrate, getMinTheoreticalBitrate, omit } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoFileMetadata, VideoState } from '@peertube/peertube-models'
import { canDoQuickTranscode } from '@peertube/peertube-server/core/lib/transcoding/transcoding-quick-transcode.js'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  ffprobePromise,
  getAudioStream,
  getVideoStreamBitrate,
  getVideoStreamDimensionsInfo,
  getVideoStreamFPS,
  hasAudioStream
} from '@peertube/peertube-ffmpeg'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { generateVideoWithFramerate, generateHighBitrateVideo } from '@tests/shared/generate.js'
import { checkWebTorrentWorks } from '@tests/shared/webtorrent.js'

function updateConfigForTranscoding (server: PeerTubeServer) {
  return server.config.updateExistingConfig({
    newConfig: {
      transcoding: {
        enabled: true,
        allowAdditionalExtensions: true,
        allowAudioFiles: true,
        hls: { enabled: true },
        webVideos: { enabled: true },
        resolutions: {
          '0p': false,
          '144p': true,
          '240p': true,
          '360p': true,
          '480p': true,
          '720p': true,
          '1080p': true,
          '1440p': true,
          '2160p': true
        }
      }
    }
  })
}

describe('Test video transcoding', function () {
  let servers: PeerTubeServer[] = []
  let video4k: string

  before(async function () {
    this.timeout(30_000)

    // Run servers
    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await updateConfigForTranscoding(servers[1])
  })

  describe('Basic transcoding (or not)', function () {

    it('Should not transcode video on server 1', async function () {
      this.timeout(60_000)

      const attributes = {
        name: 'my super name for server 1',
        description: 'my super description for server 1',
        fixture: 'video_short.webm'
      }
      await servers[0].videos.upload({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()
        const video = data[0]

        const videoDetails = await server.videos.get({ id: video.id })
        expect(videoDetails.files).to.have.lengthOf(1)

        const magnetUri = videoDetails.files[0].magnetUri
        expect(magnetUri).to.match(/\.webm/)

        await checkWebTorrentWorks(magnetUri, /\.webm$/)
      }
    })

    it('Should transcode video on server 2', async function () {
      this.timeout(120_000)

      const attributes = {
        name: 'my super name for server 2',
        description: 'my super description for server 2',
        fixture: 'video_short.webm'
      }
      await servers[1].videos.upload({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        const video = data.find(v => v.name === attributes.name)
        const videoDetails = await server.videos.get({ id: video.id })

        expect(videoDetails.files).to.have.lengthOf(5)

        const magnetUri = videoDetails.files[0].magnetUri
        expect(magnetUri).to.match(/\.mp4/)

        await checkWebTorrentWorks(magnetUri, /\.mp4$/)
      }
    })

    it('Should wait for transcoding before publishing the video', async function () {
      this.timeout(160_000)

      {
        // Upload the video, but wait transcoding
        const attributes = {
          name: 'waiting video',
          fixture: 'video_short1.webm',
          waitTranscoding: true
        }
        const { uuid } = await servers[1].videos.upload({ attributes })
        const videoId = uuid

        // Should be in transcode state
        const body = await servers[1].videos.get({ id: videoId })
        expect(body.name).to.equal('waiting video')
        expect(body.state.id).to.equal(VideoState.TO_TRANSCODE)
        expect(body.state.label).to.equal('To transcode')
        expect(body.waitTranscoding).to.be.true

        {
          // Should have my video
          const { data } = await servers[1].videos.listMyVideos()
          const videoToFindInMine = data.find(v => v.name === attributes.name)
          expect(videoToFindInMine).not.to.be.undefined
          expect(videoToFindInMine.state.id).to.equal(VideoState.TO_TRANSCODE)
          expect(videoToFindInMine.state.label).to.equal('To transcode')
          expect(videoToFindInMine.waitTranscoding).to.be.true
        }

        {
          // Should not list this video
          const { data } = await servers[1].videos.list()
          const videoToFindInList = data.find(v => v.name === attributes.name)
          expect(videoToFindInList).to.be.undefined
        }

        // Server 1 should not have the video yet
        await servers[0].videos.get({ id: videoId, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      }

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()
        const videoToFind = data.find(v => v.name === 'waiting video')
        expect(videoToFind).not.to.be.undefined

        const videoDetails = await server.videos.get({ id: videoToFind.id })

        expect(videoDetails.state.id).to.equal(VideoState.PUBLISHED)
        expect(videoDetails.state.label).to.equal('Published')
        expect(videoDetails.waitTranscoding).to.be.true
      }
    })

    it('Should accept and transcode additional extensions', async function () {
      this.timeout(300_000)

      for (const fixture of [ 'video_short.mkv', 'video_short.avi' ]) {
        const attributes = {
          name: fixture,
          fixture
        }

        await servers[1].videos.upload({ attributes })

        await waitJobs(servers)

        for (const server of servers) {
          const { data } = await server.videos.list()

          const video = data.find(v => v.name === attributes.name)
          const videoDetails = await server.videos.get({ id: video.id })
          expect(videoDetails.files).to.have.lengthOf(5)

          const magnetUri = videoDetails.files[0].magnetUri
          expect(magnetUri).to.contain('.mp4')
        }
      }
    })

    it('Should transcode a 4k video', async function () {
      this.timeout(200_000)

      const attributes = {
        name: '4k video',
        fixture: 'video_short_4k.mp4'
      }

      const { uuid } = await servers[1].videos.upload({ attributes })
      video4k = uuid

      await waitJobs(servers)

      const resolutions = [ 144, 240, 360, 480, 720, 1080, 1440, 2160 ]

      for (const server of servers) {
        const videoDetails = await server.videos.get({ id: video4k })
        expect(videoDetails.files).to.have.lengthOf(resolutions.length)

        for (const r of resolutions) {
          expect(videoDetails.files.find(f => f.resolution.id === r)).to.not.be.undefined
          expect(videoDetails.streamingPlaylists[0].files.find(f => f.resolution.id === r)).to.not.be.undefined
        }
      }
    })
  })

  describe('Audio transcoding', function () {

    it('Should transcode high bit rate mp3 to proper bit rate', async function () {
      this.timeout(120_000)

      const attributes = {
        name: 'mp3_256k',
        fixture: 'video_short_mp3_256k.mp4'
      }
      await servers[1].videos.upload({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        const video = data.find(v => v.name === attributes.name)
        const videoDetails = await server.videos.get({ id: video.id })

        expect(videoDetails.files).to.have.lengthOf(5)

        const file = videoDetails.files.find(f => f.resolution.id === 240)
        const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)
        const probe = await getAudioStream(path)

        if (probe.audioStream) {
          expect(probe.audioStream['codec_name']).to.be.equal('aac')
          expect(probe.audioStream['bit_rate']).to.be.at.most(384 * 8000)
        } else {
          this.fail('Could not retrieve the audio stream on ' + probe.absolutePath)
        }
      }
    })

    it('Should transcode video with no audio and have no audio itself', async function () {
      this.timeout(120_000)

      const attributes = {
        name: 'no_audio',
        fixture: 'video_short_no_audio.mp4'
      }
      await servers[1].videos.upload({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        const video = data.find(v => v.name === attributes.name)
        const videoDetails = await server.videos.get({ id: video.id })

        const file = videoDetails.files.find(f => f.resolution.id === 240)
        const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)

        expect(await hasAudioStream(path)).to.be.false
      }
    })

    it('Should leave the audio untouched, but properly transcode the video', async function () {
      this.timeout(120_000)

      const attributes = {
        name: 'untouched_audio',
        fixture: 'video_short.mp4'
      }
      await servers[1].videos.upload({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        const video = data.find(v => v.name === attributes.name)
        const videoDetails = await server.videos.get({ id: video.id })

        expect(videoDetails.files).to.have.lengthOf(5)

        const fixturePath = buildAbsoluteFixturePath(attributes.fixture)
        const fixtureVideoProbe = await getAudioStream(fixturePath)

        const file = videoDetails.files.find(f => f.resolution.id === 240)
        const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)

        const videoProbe = await getAudioStream(path)

        if (videoProbe.audioStream && fixtureVideoProbe.audioStream) {
          const toOmit = [ 'max_bit_rate', 'duration', 'duration_ts', 'nb_frames', 'start_time', 'start_pts' ]
          expect(omit(videoProbe.audioStream, toOmit)).to.be.deep.equal(omit(fixtureVideoProbe.audioStream, toOmit))
        } else {
          this.fail('Could not retrieve the audio stream on ' + videoProbe.absolutePath)
        }
      }
    })
  })

  describe('Audio upload', function () {

    function runSuite (mode: 'legacy' | 'resumable') {

      before(async function () {
        await servers[1].config.updateExistingConfig({
          newConfig: {
            transcoding: {
              hls: { enabled: true },
              webVideos: { enabled: true },
              resolutions: {
                '0p': false,
                '144p': false,
                '240p': false,
                '360p': false,
                '480p': false,
                '720p': false,
                '1080p': false,
                '1440p': false,
                '2160p': false
              }
            }
          }
        })
      })

      it('Should merge an audio file with the preview file', async function () {
        this.timeout(60_000)

        const attributes = { name: 'audio_with_preview', previewfile: 'custom-preview.jpg', fixture: 'sample.ogg' }
        await servers[1].videos.upload({ attributes, mode })

        await waitJobs(servers)

        for (const server of servers) {
          const { data } = await server.videos.list()

          const video = data.find(v => v.name === 'audio_with_preview')
          const videoDetails = await server.videos.get({ id: video.id })

          expect(videoDetails.files).to.have.lengthOf(1)

          await makeGetRequest({ url: server.url, path: videoDetails.thumbnailPath, expectedStatus: HttpStatusCode.OK_200 })
          await makeGetRequest({ url: server.url, path: videoDetails.previewPath, expectedStatus: HttpStatusCode.OK_200 })

          const magnetUri = videoDetails.files[0].magnetUri
          expect(magnetUri).to.contain('.mp4')
        }
      })

      it('Should upload an audio file and choose a default background image', async function () {
        this.timeout(60_000)

        const attributes = { name: 'audio_without_preview', fixture: 'sample.ogg' }
        await servers[1].videos.upload({ attributes, mode })

        await waitJobs(servers)

        for (const server of servers) {
          const { data } = await server.videos.list()

          const video = data.find(v => v.name === 'audio_without_preview')
          const videoDetails = await server.videos.get({ id: video.id })

          expect(videoDetails.files).to.have.lengthOf(1)

          await makeGetRequest({ url: server.url, path: videoDetails.thumbnailPath, expectedStatus: HttpStatusCode.OK_200 })
          await makeGetRequest({ url: server.url, path: videoDetails.previewPath, expectedStatus: HttpStatusCode.OK_200 })

          const magnetUri = videoDetails.files[0].magnetUri
          expect(magnetUri).to.contain('.mp4')
        }
      })

      it('Should upload an audio file and create an audio version only', async function () {
        this.timeout(60_000)

        await servers[1].config.updateExistingConfig({
          newConfig: {
            transcoding: {
              hls: { enabled: true },
              webVideos: { enabled: true },
              resolutions: {
                '0p': true,
                '144p': false,
                '240p': false,
                '360p': false
              }
            }
          }
        })

        const attributes = { name: 'audio_with_preview', previewfile: 'custom-preview.jpg', fixture: 'sample.ogg' }
        const { id } = await servers[1].videos.upload({ attributes, mode })

        await waitJobs(servers)

        for (const server of servers) {
          const videoDetails = await server.videos.get({ id })

          for (const files of [ videoDetails.files, videoDetails.streamingPlaylists[0].files ]) {
            expect(files).to.have.lengthOf(2)
            expect(files.find(f => f.resolution.id === 0)).to.not.be.undefined
          }
        }

        await updateConfigForTranscoding(servers[1])
      })
    }

    describe('Legacy upload', function () {
      runSuite('legacy')
    })

    describe('Resumable upload', function () {
      runSuite('resumable')
    })
  })

  describe('Framerate', function () {

    it('Should transcode a 60 FPS video', async function () {
      this.timeout(60_000)

      const attributes = {
        name: 'my super 30fps name for server 2',
        description: 'my super 30fps description for server 2',
        fixture: '60fps_720p_small.mp4'
      }
      await servers[1].videos.upload({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        const video = data.find(v => v.name === attributes.name)
        const videoDetails = await server.videos.get({ id: video.id })

        expect(videoDetails.files).to.have.lengthOf(5)
        expect(videoDetails.files[0].fps).to.be.above(58).and.below(62)
        expect(videoDetails.files[1].fps).to.be.below(31)
        expect(videoDetails.files[2].fps).to.be.below(31)
        expect(videoDetails.files[3].fps).to.be.below(31)
        expect(videoDetails.files[4].fps).to.be.below(31)

        for (const resolution of [ 144, 240, 360, 480 ]) {
          const file = videoDetails.files.find(f => f.resolution.id === resolution)
          const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)
          const fps = await getVideoStreamFPS(path)

          expect(fps).to.be.below(31)
        }

        const file = videoDetails.files.find(f => f.resolution.id === 720)
        const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)
        const fps = await getVideoStreamFPS(path)

        expect(fps).to.be.above(58).and.below(62)
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

      const attributes = {
        name: '59fps video',
        description: '59fps video',
        fixture: tempFixturePath
      }

      await servers[1].videos.upload({ attributes })

      await waitJobs(servers)

      for (const server of servers) {
        const { data } = await server.videos.list()

        const { id } = data.find(v => v.name === attributes.name)
        const video = await server.videos.get({ id })

        {
          const file = video.files.find(f => f.resolution.id === 240)
          const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)
          const fps = await getVideoStreamFPS(path)
          expect(fps).to.be.equal(25)
        }

        {
          const file = video.files.find(f => f.resolution.id === 720)
          const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)
          const fps = await getVideoStreamFPS(path)
          expect(fps).to.be.equal(59)
        }
      }
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

  describe('FFprobe', function () {

    it('Should provide valid ffprobe data', async function () {
      this.timeout(160_000)

      const videoUUID = (await servers[1].videos.quickUpload({ name: 'ffprobe data' })).uuid
      await waitJobs(servers)

      {
        const video = await servers[1].videos.get({ id: videoUUID })
        const file = video.files.find(f => f.resolution.id === 240)
        const path = servers[1].servers.buildWebVideoFilePath(file.fileUrl)

        const probe = await ffprobePromise(path)
        const metadata = new VideoFileMetadata(probe)

        // expected format properties
        for (const p of [
          'tags.encoder',
          'format_long_name',
          'size',
          'bit_rate'
        ]) {
          expect(metadata.format).to.have.nested.property(p)
        }

        // expected stream properties
        for (const p of [
          'codec_long_name',
          'profile',
          'width',
          'height',
          'display_aspect_ratio',
          'avg_frame_rate',
          'pix_fmt'
        ]) {
          expect(metadata.streams[0]).to.have.nested.property(p)
        }

        expect(metadata).to.not.have.nested.property('format.filename')
      }

      for (const server of servers) {
        const videoDetails = await server.videos.get({ id: videoUUID })

        const videoFiles = getAllFiles(videoDetails)
        expect(videoFiles).to.have.lengthOf(10)

        for (const file of videoFiles) {
          expect(file.metadata).to.be.undefined
          expect(file.metadataUrl).to.exist
          expect(file.metadataUrl).to.contain(servers[1].url)
          expect(file.metadataUrl).to.contain(videoUUID)

          const metadata = await server.videos.getFileMetadata({ url: file.metadataUrl })
          expect(metadata).to.have.nested.property('format.size')
        }
      }
    })

    it('Should correctly detect if quick transcode is possible', async function () {
      this.timeout(10_000)

      expect(await canDoQuickTranscode(buildAbsoluteFixturePath('video_short.mp4'))).to.be.true
      expect(await canDoQuickTranscode(buildAbsoluteFixturePath('video_short.webm'))).to.be.false
    })
  })

  describe('Transcoding job queue', function () {

    it('Should have the appropriate priorities for transcoding jobs', async function () {
      const body = await servers[1].jobs.list({
        start: 0,
        count: 100,
        sort: 'createdAt',
        jobType: 'video-transcoding'
      })

      const jobs = body.data
      const transcodingJobs = jobs.filter(j => j.data.videoUUID === video4k)

      expect(transcodingJobs).to.have.lengthOf(16)

      const hlsJobs = transcodingJobs.filter(j => j.data.type === 'new-resolution-to-hls')
      const webVideoJobs = transcodingJobs.filter(j => j.data.type === 'new-resolution-to-web-video')
      const optimizeJobs = transcodingJobs.filter(j => j.data.type === 'optimize-to-web-video')

      expect(hlsJobs).to.have.lengthOf(8)
      expect(webVideoJobs).to.have.lengthOf(7)
      expect(optimizeJobs).to.have.lengthOf(1)

      for (const j of optimizeJobs.concat(hlsJobs.concat(webVideoJobs))) {
        expect(j.priority).to.be.greaterThan(100)
        expect(j.priority).to.be.lessThan(150)
      }
    })
  })

  describe('Bounded transcoding', function () {

    it('Should not generate an upper resolution than original file', async function () {
      this.timeout(120_000)

      await servers[0].config.updateExistingConfig({
        newConfig: {
          transcoding: {
            enabled: true,
            hls: { enabled: true },
            webVideos: { enabled: true },
            resolutions: {
              '0p': false,
              '144p': false,
              '240p': true,
              '360p': false,
              '480p': true,
              '720p': false,
              '1080p': false,
              '1440p': false,
              '2160p': false
            },
            alwaysTranscodeOriginalResolution: false
          }
        }
      })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video', fixture: 'video_short.webm' })
      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      const hlsFiles = video.streamingPlaylists[0].files

      expect(video.files).to.have.lengthOf(2)
      expect(hlsFiles).to.have.lengthOf(2)

      // eslint-disable-next-line @typescript-eslint/require-array-sort-compare
      const resolutions = getAllFiles(video).map(f => f.resolution.id).sort()
      expect(resolutions).to.deep.equal([ 240, 240, 480, 480 ])
    })

    it('Should only keep the original resolution if all resolutions are disabled', async function () {
      this.timeout(120_000)

      await servers[0].config.updateExistingConfig({
        newConfig: {
          transcoding: {
            resolutions: {
              '0p': false,
              '144p': false,
              '240p': false,
              '360p': false,
              '480p': false,
              '720p': false,
              '1080p': false,
              '1440p': false,
              '2160p': false
            }
          }
        }
      })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video', fixture: 'video_short.webm' })
      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      const hlsFiles = video.streamingPlaylists[0].files

      expect(video.files).to.have.lengthOf(1)
      expect(hlsFiles).to.have.lengthOf(1)

      expect(video.files[0].resolution.id).to.equal(720)
      expect(hlsFiles[0].resolution.id).to.equal(720)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
