/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { omit } from 'lodash'
import * as ffmpeg from 'fluent-ffmpeg'
import { VideoDetails, VideoState } from '../../../../shared/models/videos'
import { getVideoFileFPS, audio } from '../../../helpers/ffmpeg-utils'
import {
  buildAbsoluteFixturePath,
  doubleFollow,
  flushAndRunMultipleServers,
  getMyVideos,
  getVideo,
  getVideosList,
  killallServers,
  root,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  webtorrentAdd
} from '../../utils'
import { join } from 'path'
import { waitJobs } from '../../utils/server/jobs'

const expect = chai.expect

describe('Test video transcoding', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(30000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])
  })

  it('Should not transcode video on server 1', async function () {
    this.timeout(60000)

    const videoAttributes = {
      name: 'my super name for server 1',
      description: 'my super description for server 1',
      fixture: 'video_short.webm'
    }
    await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      const video = res.body.data[ 0 ]

      const res2 = await getVideo(server.url, video.id)
      const videoDetails = res2.body
      expect(videoDetails.files).to.have.lengthOf(1)

      const magnetUri = videoDetails.files[ 0 ].magnetUri
      expect(magnetUri).to.match(/\.webm/)

      const torrent = await webtorrentAdd(magnetUri, true)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[ 0 ].path).match(/\.webm$/)
    }
  })

  it('Should transcode video on server 2', async function () {
    this.timeout(60000)

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

      const magnetUri = videoDetails.files[ 0 ].magnetUri
      expect(magnetUri).to.match(/\.mp4/)

      const torrent = await webtorrentAdd(magnetUri, true)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[ 0 ].path).match(/\.mp4$/)
    }
  })

  it('Should transcode high bit rate mp3 to proper bit rate', async function () {
    this.timeout(60000)

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

      const path = join(root(), 'test2', 'videos', video.uuid + '-240.mp4')
      const probe = await audio.get(ffmpeg, path)

      if (probe.audioStream) {
        expect(probe.audioStream[ 'codec_name' ]).to.be.equal('aac')
        expect(probe.audioStream[ 'bit_rate' ]).to.be.at.most(384 * 8000)
      } else {
        this.fail('Could not retrieve the audio stream on ' + probe.absolutePath)
      }
    }
  })

  it('Should transcode video with no audio and have no audio itself', async function () {
    this.timeout(60000)

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
      const path = join(root(), 'test2', 'videos', video.uuid + '-240.mp4')
      const probe = await audio.get(ffmpeg, path)
      expect(probe).to.not.have.property('audioStream')
    }
  })

  it('Should leave the audio untouched, but properly transcode the video', async function () {
    this.timeout(60000)

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
      const fixtureVideoProbe = await audio.get(ffmpeg, fixturePath)
      const path = join(root(), 'test2', 'videos', video.uuid + '-240.mp4')
      const videoProbe = await audio.get(ffmpeg, path)
      if (videoProbe.audioStream && fixtureVideoProbe.audioStream) {
        const toOmit = [ 'max_bit_rate', 'duration', 'duration_ts', 'nb_frames', 'start_time', 'start_pts' ]
        expect(omit(videoProbe.audioStream, toOmit)).to.be.deep.equal(omit(fixtureVideoProbe.audioStream, toOmit))
      } else {
        this.fail('Could not retrieve the audio stream on ' + videoProbe.absolutePath)
      }
    }
  })

  it('Should transcode a 60 FPS video', async function () {
    this.timeout(60000)

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
      expect(videoDetails.files[ 0 ].fps).to.be.above(58).and.below(62)
      expect(videoDetails.files[ 1 ].fps).to.be.below(31)
      expect(videoDetails.files[ 2 ].fps).to.be.below(31)
      expect(videoDetails.files[ 3 ].fps).to.be.below(31)

      for (const resolution of [ '240', '360', '480' ]) {
        const path = join(root(), 'test2', 'videos', video.uuid + '-' + resolution + '.mp4')
        const fps = await getVideoFileFPS(path)

        expect(fps).to.be.below(31)
      }

      const path = join(root(), 'test2', 'videos', video.uuid + '-720.mp4')
      const fps = await getVideoFileFPS(path)

      expect(fps).to.be.above(58).and.below(62)
    }
  })

  it('Should wait transcoding before publishing the video', async function () {
    this.timeout(80000)

    {
      // Upload the video, but wait transcoding
      const videoAttributes = {
        name: 'waiting video',
        fixture: 'video_short1.webm',
        waitTranscoding: true
      }
      const resVideo = await uploadVideo(servers[ 1 ].url, servers[ 1 ].accessToken, videoAttributes)
      const videoId = resVideo.body.video.uuid

      // Should be in transcode state
      const { body } = await getVideo(servers[ 1 ].url, videoId)
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
      await getVideo(servers[0].url, videoId, 404)
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

  after(async function () {
    killallServers(servers)
  })
})
