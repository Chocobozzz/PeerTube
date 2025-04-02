/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getAllFiles, omit } from '@peertube/peertube-core-utils'
import {
  ffprobePromise,
  getAudioStream,
  hasAudioStream
} from '@peertube/peertube-ffmpeg'
import { HttpStatusCode, VideoFileMetadata, VideoState } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { canDoQuickTranscode } from '@peertube/peertube-server/core/lib/transcoding/transcoding-quick-transcode.js'
import { checkWebTorrentWorks } from '@tests/shared/p2p.js'
import { expect } from 'chai'

describe('Test video transcoding', function () {
  let servers: PeerTubeServer[] = []
  let video4k: string

  before(async function () {
    this.timeout(30_000)

    // Run servers
    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[1].config.enableTranscoding({
      alwaysTranscodeOriginalResolution: true,
      resolutions: 'max',
      hls: true,
      webVideo: true,
      with0p: false
    })
  })

  describe('Common transcoding', function () {

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
        await servers[1].config.enableTranscoding({ hls: true, webVideo: true, resolutions: [] })
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

        await servers[1].config.enableTranscoding({ alwaysTranscodeOriginalResolution: true, hls: true, webVideo: true, with0p: false })
      })
    }

    describe('Legacy upload', function () {
      runSuite('legacy')
    })

    describe('Resumable upload', function () {
      runSuite('resumable')
    })
  })

  describe('FFprobe', function () {

    it('Should provide valid ffprobe data', async function () {
      this.timeout(160_000)

      await servers[1].config.enableTranscoding({ resolutions: 'max' })

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

      expect(await canDoQuickTranscode(buildAbsoluteFixturePath('video_short.mp4'), 60)).to.be.true
      expect(await canDoQuickTranscode(buildAbsoluteFixturePath('video_short.webm'), 60)).to.be.false
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

  after(async function () {
    await cleanupTests(servers)
  })
})
