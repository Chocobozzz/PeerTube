/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { FfprobeData } from 'fluent-ffmpeg'
import { omit } from 'lodash'
import { join } from 'path'
import { Job } from '@shared/models'
import { VIDEO_TRANSCODING_FPS } from '../../../../server/initializers/constants'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'
import {
  buildAbsoluteFixturePath,
  buildServerDirectory,
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  generateHighBitrateVideo,
  generateVideoWithFramerate,
  getJobsListPaginationAndSort,
  getMyVideos,
  getServerFileSize,
  getVideo,
  getVideoFileMetadataUrl,
  getVideosList,
  makeGetRequest,
  ServerInfo,
  setAccessTokensToServers,
  updateCustomSubConfig,
  uploadVideo,
  uploadVideoAndGetId,
  waitJobs,
  webtorrentAdd
} from '../../../../shared/extra-utils'
import { getMaxBitrate, VideoDetails, VideoResolution, VideoState } from '../../../../shared/models/videos'
import {
  canDoQuickTranscode,
  getAudioStream,
  getMetadataFromFile,
  getVideoFileBitrate,
  getVideoFileFPS,
  getVideoFileResolution
} from '../../../helpers/ffprobe-utils'

const expect = chai.expect

describe('Test video transcoding', function () {
  let servers: ServerInfo[] = []
  let video4k: string

  before(async function () {
    this.timeout(30_000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])
  })

  it('Should not transcode video on server 1', async function () {
    this.timeout(60_000)

    const videoAttributes = {
      name: 'my super name for server 1',
      description: 'my super description for server 1',
      fixture: 'video_short.webm'
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      const video = res.body.data[0]

      const res2 = await getVideo(server.url, video.id)
      const videoDetails = res2.body
      expect(videoDetails.files).to.have.lengthOf(1)

      const magnetUri = videoDetails.files[0].magnetUri
      expect(magnetUri).to.match(/\.webm/)

      const torrent = await webtorrentAdd(magnetUri, true)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).match(/\.webm$/)
    }
  })

  it('Should transcode video on server 2', async function () {
    this.timeout(120_000)

    const videoAttributes = {
      name: 'my super name for server 2',
      description: 'my super description for server 2',
      fixture: 'video_short.webm'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      const video = res.body.data.find(v => v.name === videoAttributes.name)
      const res2 = await getVideo(server.url, video.id)
      const videoDetails = res2.body

      expect(videoDetails.files).to.have.lengthOf(4)

      const magnetUri = videoDetails.files[0].magnetUri
      expect(magnetUri).to.match(/\.mp4/)

      const torrent = await webtorrentAdd(magnetUri, true)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).match(/\.mp4$/)
    }
  })

  it('Should transcode high bit rate mp3 to proper bit rate', async function () {
    this.timeout(60_000)

    const videoAttributes = {
      name: 'mp3_256k',
      fixture: 'video_short_mp3_256k.mp4'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      const video = res.body.data.find(v => v.name === videoAttributes.name)
      const res2 = await getVideo(server.url, video.id)
      const videoDetails: VideoDetails = res2.body

      expect(videoDetails.files).to.have.lengthOf(4)

      const path = buildServerDirectory(servers[1], join('videos', video.uuid + '-240.mp4'))
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
    this.timeout(60_000)

    const videoAttributes = {
      name: 'no_audio',
      fixture: 'video_short_no_audio.mp4'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      const video = res.body.data.find(v => v.name === videoAttributes.name)
      const res2 = await getVideo(server.url, video.id)
      const videoDetails: VideoDetails = res2.body

      expect(videoDetails.files).to.have.lengthOf(4)
      const path = buildServerDirectory(servers[1], join('videos', video.uuid + '-240.mp4'))
      const probe = await getAudioStream(path)
      expect(probe).to.not.have.property('audioStream')
    }
  })

  it('Should leave the audio untouched, but properly transcode the video', async function () {
    this.timeout(60_000)

    const videoAttributes = {
      name: 'untouched_audio',
      fixture: 'video_short.mp4'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      const video = res.body.data.find(v => v.name === videoAttributes.name)
      const res2 = await getVideo(server.url, video.id)
      const videoDetails: VideoDetails = res2.body

      expect(videoDetails.files).to.have.lengthOf(4)

      const fixturePath = buildAbsoluteFixturePath(videoAttributes.fixture)
      const fixtureVideoProbe = await getAudioStream(fixturePath)
      const path = buildServerDirectory(servers[1], join('videos', video.uuid + '-240.mp4'))

      const videoProbe = await getAudioStream(path)

      if (videoProbe.audioStream && fixtureVideoProbe.audioStream) {
        const toOmit = [ 'max_bit_rate', 'duration', 'duration_ts', 'nb_frames', 'start_time', 'start_pts' ]
        expect(omit(videoProbe.audioStream, toOmit)).to.be.deep.equal(omit(fixtureVideoProbe.audioStream, toOmit))
      } else {
        this.fail('Could not retrieve the audio stream on ' + videoProbe.absolutePath)
      }
    }
  })

  it('Should transcode a 60 FPS video', async function () {
    this.timeout(60_000)

    const videoAttributes = {
      name: 'my super 30fps name for server 2',
      description: 'my super 30fps description for server 2',
      fixture: '60fps_720p_small.mp4'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      const video = res.body.data.find(v => v.name === videoAttributes.name)
      const res2 = await getVideo(server.url, video.id)
      const videoDetails: VideoDetails = res2.body

      expect(videoDetails.files).to.have.lengthOf(4)
      expect(videoDetails.files[0].fps).to.be.above(58).and.below(62)
      expect(videoDetails.files[1].fps).to.be.below(31)
      expect(videoDetails.files[2].fps).to.be.below(31)
      expect(videoDetails.files[3].fps).to.be.below(31)

      for (const resolution of [ '240', '360', '480' ]) {
        const path = buildServerDirectory(servers[1], join('videos', video.uuid + '-' + resolution + '.mp4'))
        const fps = await getVideoFileFPS(path)

        expect(fps).to.be.below(31)
      }

      const path = buildServerDirectory(servers[1], join('videos', video.uuid + '-720.mp4'))
      const fps = await getVideoFileFPS(path)

      expect(fps).to.be.above(58).and.below(62)
    }
  })

  it('Should wait for transcoding before publishing the video', async function () {
    this.timeout(160_000)

    {
      // Upload the video, but wait transcoding
      const videoAttributes = {
        name: 'waiting video',
        fixture: 'video_short1.webm',
        waitTranscoding: true
      }
      const resVideo = await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)
      const videoId = resVideo.body.video.uuid

      // Should be in transcode state
      const { body } = await getVideo(servers[1].url, videoId)
      expect(body.name).to.equal('waiting video')
      expect(body.state.id).to.equal(VideoState.TO_TRANSCODE)
      expect(body.state.label).to.equal('To transcode')
      expect(body.waitTranscoding).to.be.true

      // Should have my video
      const resMyVideos = await getMyVideos(servers[1].url, servers[1].accessToken, 0, 10)
      const videoToFindInMine = resMyVideos.body.data.find(v => v.name === videoAttributes.name)
      expect(videoToFindInMine).not.to.be.undefined
      expect(videoToFindInMine.state.id).to.equal(VideoState.TO_TRANSCODE)
      expect(videoToFindInMine.state.label).to.equal('To transcode')
      expect(videoToFindInMine.waitTranscoding).to.be.true

      // Should not list this video
      const resVideos = await getVideosList(servers[1].url)
      const videoToFindInList = resVideos.body.data.find(v => v.name === videoAttributes.name)
      expect(videoToFindInList).to.be.undefined

      // Server 1 should not have the video yet
      await getVideo(servers[0].url, videoId, HttpStatusCode.NOT_FOUND_404)
    }

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      const videoToFind = res.body.data.find(v => v.name === 'waiting video')
      expect(videoToFind).not.to.be.undefined

      const res2 = await getVideo(server.url, videoToFind.id)
      const videoDetails: VideoDetails = res2.body

      expect(videoDetails.state.id).to.equal(VideoState.PUBLISHED)
      expect(videoDetails.state.label).to.equal('Published')
      expect(videoDetails.waitTranscoding).to.be.true
    }
  })

  it('Should respect maximum bitrate values', async function () {
    this.timeout(160_000)

    let tempFixturePath: string

    {
      tempFixturePath = await generateHighBitrateVideo()

      const bitrate = await getVideoFileBitrate(tempFixturePath)
      expect(bitrate).to.be.above(getMaxBitrate(VideoResolution.H_1080P, 25, VIDEO_TRANSCODING_FPS))
    }

    const videoAttributes = {
      name: 'high bitrate video',
      description: 'high bitrate video',
      fixture: tempFixturePath
    }

    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      const video = res.body.data.find(v => v.name === videoAttributes.name)

      for (const resolution of [ '240', '360', '480', '720', '1080' ]) {
        const path = buildServerDirectory(servers[1], join('videos', video.uuid + '-' + resolution + '.mp4'))

        const bitrate = await getVideoFileBitrate(path)
        const fps = await getVideoFileFPS(path)
        const resolution2 = await getVideoFileResolution(path)

        expect(resolution2.videoFileResolution.toString()).to.equal(resolution)
        expect(bitrate).to.be.below(getMaxBitrate(resolution2.videoFileResolution, fps, VIDEO_TRANSCODING_FPS))
      }
    }
  })

  it('Should accept and transcode additional extensions', async function () {
    this.timeout(300_000)

    let tempFixturePath: string

    {
      tempFixturePath = await generateHighBitrateVideo()

      const bitrate = await getVideoFileBitrate(tempFixturePath)
      expect(bitrate).to.be.above(getMaxBitrate(VideoResolution.H_1080P, 25, VIDEO_TRANSCODING_FPS))
    }

    for (const fixture of [ 'video_short.mkv', 'video_short.avi' ]) {
      const videoAttributes = {
        name: fixture,
        fixture
      }

      await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getVideosList(server.url)

        const video = res.body.data.find(v => v.name === videoAttributes.name)
        const res2 = await getVideo(server.url, video.id)
        const videoDetails = res2.body

        expect(videoDetails.files).to.have.lengthOf(4)

        const magnetUri = videoDetails.files[0].magnetUri
        expect(magnetUri).to.contain('.mp4')
      }
    }
  })

  it('Should correctly detect if quick transcode is possible', async function () {
    this.timeout(10_000)

    expect(await canDoQuickTranscode(buildAbsoluteFixturePath('video_short.mp4'))).to.be.true
    expect(await canDoQuickTranscode(buildAbsoluteFixturePath('video_short.webm'))).to.be.false
  })

  it('Should merge an audio file with the preview file', async function () {
    this.timeout(60_000)

    const videoAttributesArg = { name: 'audio_with_preview', previewfile: 'preview.jpg', fixture: 'sample.ogg' }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributesArg)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      const video = res.body.data.find(v => v.name === 'audio_with_preview')
      const res2 = await getVideo(server.url, video.id)
      const videoDetails: VideoDetails = res2.body

      expect(videoDetails.files).to.have.lengthOf(1)

      await makeGetRequest({ url: server.url, path: videoDetails.thumbnailPath, statusCodeExpected: HttpStatusCode.OK_200 })
      await makeGetRequest({ url: server.url, path: videoDetails.previewPath, statusCodeExpected: HttpStatusCode.OK_200 })

      const magnetUri = videoDetails.files[0].magnetUri
      expect(magnetUri).to.contain('.mp4')
    }
  })

  it('Should upload an audio file and choose a default background image', async function () {
    this.timeout(60_000)

    const videoAttributesArg = { name: 'audio_without_preview', fixture: 'sample.ogg' }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributesArg)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      const video = res.body.data.find(v => v.name === 'audio_without_preview')
      const res2 = await getVideo(server.url, video.id)
      const videoDetails = res2.body

      expect(videoDetails.files).to.have.lengthOf(1)

      await makeGetRequest({ url: server.url, path: videoDetails.thumbnailPath, statusCodeExpected: HttpStatusCode.OK_200 })
      await makeGetRequest({ url: server.url, path: videoDetails.previewPath, statusCodeExpected: HttpStatusCode.OK_200 })

      const magnetUri = videoDetails.files[0].magnetUri
      expect(magnetUri).to.contain('.mp4')
    }
  })

  it('Should downscale to the closest divisor standard framerate', async function () {
    this.timeout(200_000)

    let tempFixturePath: string

    {
      tempFixturePath = await generateVideoWithFramerate(59)

      const fps = await getVideoFileFPS(tempFixturePath)
      expect(fps).to.be.equal(59)
    }

    const videoAttributes = {
      name: '59fps video',
      description: '59fps video',
      fixture: tempFixturePath
    }

    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      const video = res.body.data.find(v => v.name === videoAttributes.name)

      {
        const path = buildServerDirectory(servers[1], join('videos', video.uuid + '-240.mp4'))
        const fps = await getVideoFileFPS(path)
        expect(fps).to.be.equal(25)
      }

      {
        const path = buildServerDirectory(servers[1], join('videos', video.uuid + '-720.mp4'))
        const fps = await getVideoFileFPS(path)
        expect(fps).to.be.equal(59)
      }
    }
  })

  it('Should not transcode to an higher bitrate than the original file', async function () {
    this.timeout(160_000)

    const config = {
      transcoding: {
        enabled: true,
        resolutions: {
          '240p': true,
          '360p': true,
          '480p': true,
          '720p': true,
          '1080p': true,
          '1440p': true,
          '2160p': true
        },
        webtorrent: { enabled: true },
        hls: { enabled: true }
      }
    }
    await updateCustomSubConfig(servers[1].url, servers[1].accessToken, config)

    const videoAttributes = {
      name: 'low bitrate',
      fixture: 'low-bitrate.mp4'
    }

    const resUpload = await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)
    const videoUUID = resUpload.body.video.uuid

    await waitJobs(servers)

    const resolutions = [ 240, 360, 480, 720, 1080 ]
    for (const r of resolutions) {
      expect(await getServerFileSize(servers[1], `videos/${videoUUID}-${r}.mp4`)).to.be.below(60_000)
    }
  })

  it('Should provide valid ffprobe data', async function () {
    this.timeout(160_000)

    const videoUUID = (await uploadVideoAndGetId({ server: servers[1], videoName: 'ffprobe data' })).uuid
    await waitJobs(servers)

    {
      const path = buildServerDirectory(servers[1], join('videos', videoUUID + '-240.mp4'))
      const metadata = await getMetadataFromFile(path)

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
      const res2 = await getVideo(server.url, videoUUID)
      const videoDetails: VideoDetails = res2.body

      const videoFiles = videoDetails.files
                                     .concat(videoDetails.streamingPlaylists[0].files)
      expect(videoFiles).to.have.lengthOf(8)

      for (const file of videoFiles) {
        expect(file.metadata).to.be.undefined
        expect(file.metadataUrl).to.exist
        expect(file.metadataUrl).to.contain(servers[1].url)
        expect(file.metadataUrl).to.contain(videoUUID)

        const res3 = await getVideoFileMetadataUrl(file.metadataUrl)
        const metadata: FfprobeData = res3.body
        expect(metadata).to.have.nested.property('format.size')
      }
    }
  })

  it('Should transcode a 4k video', async function () {
    this.timeout(200_000)

    const videoAttributes = {
      name: '4k video',
      fixture: 'video_short_4k.mp4'
    }

    const resUpload = await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)
    video4k = resUpload.body.video.uuid

    await waitJobs(servers)

    const resolutions = [ 240, 360, 480, 720, 1080, 1440, 2160 ]

    for (const server of servers) {
      const res = await getVideo(server.url, video4k)
      const videoDetails: VideoDetails = res.body

      expect(videoDetails.files).to.have.lengthOf(resolutions.length)

      for (const r of resolutions) {
        expect(videoDetails.files.find(f => f.resolution.id === r)).to.not.be.undefined
        expect(videoDetails.streamingPlaylists[0].files.find(f => f.resolution.id === r)).to.not.be.undefined
      }
    }
  })

  it('Should have the appropriate priorities for transcoding jobs', async function () {
    const res = await getJobsListPaginationAndSort({
      url: servers[1].url,
      accessToken: servers[1].accessToken,
      start: 0,
      count: 100,
      sort: '-createdAt',
      jobType: 'video-transcoding'
    })

    const jobs = res.body.data as Job[]

    const transcodingJobs = jobs.filter(j => j.data.videoUUID === video4k)

    expect(transcodingJobs).to.have.lengthOf(14)

    const hlsJobs = transcodingJobs.filter(j => j.data.type === 'new-resolution-to-hls')
    const webtorrentJobs = transcodingJobs.filter(j => j.data.type === 'new-resolution-to-webtorrent')
    const optimizeJobs = transcodingJobs.filter(j => j.data.type === 'optimize-to-webtorrent')

    expect(hlsJobs).to.have.lengthOf(7)
    expect(webtorrentJobs).to.have.lengthOf(6)
    expect(optimizeJobs).to.have.lengthOf(1)

    for (const j of optimizeJobs) {
      expect(j.priority).to.be.greaterThan(11)
      expect(j.priority).to.be.lessThan(50)
    }

    for (const j of hlsJobs.concat(webtorrentJobs)) {
      expect(j.priority).to.be.greaterThan(100)
      expect(j.priority).to.be.lessThan(150)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
