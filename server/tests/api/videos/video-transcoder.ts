/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import { VideoDetails, VideoState } from '../../../../shared/models/videos'
import { getVideoFileFPS } from '../../../helpers/ffmpeg-utils'
import {
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

    const res = await getVideosList(servers[0].url)
    const video = res.body.data[0]

    const res2 = await getVideo(servers[0].url, video.id)
    const videoDetails = res2.body
    expect(videoDetails.files).to.have.lengthOf(1)

    const magnetUri = videoDetails.files[0].magnetUri
    expect(magnetUri).to.match(/\.webm/)

    const torrent = await webtorrentAdd(magnetUri)
    expect(torrent.files).to.be.an('array')
    expect(torrent.files.length).to.equal(1)
    expect(torrent.files[0].path).match(/\.webm$/)
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

    const res = await getVideosList(servers[1].url)

    const video = res.body.data[0]
    const res2 = await getVideo(servers[1].url, video.id)
    const videoDetails = res2.body

    expect(videoDetails.files).to.have.lengthOf(4)

    const magnetUri = videoDetails.files[0].magnetUri
    expect(magnetUri).to.match(/\.mp4/)

    const torrent = await webtorrentAdd(magnetUri)
    expect(torrent.files).to.be.an('array')
    expect(torrent.files.length).to.equal(1)
    expect(torrent.files[0].path).match(/\.mp4$/)
  })

  it('Should transcode to 30 FPS', async function () {
    this.timeout(60000)

    const videoAttributes = {
      name: 'my super 30fps name for server 2',
      description: 'my super 30fps description for server 2',
      fixture: 'video_60fps_short.mp4'
    }
    await uploadVideo(servers[1].url, servers[1].accessToken, videoAttributes)

    await waitJobs(servers)

    const res = await getVideosList(servers[1].url)

    const video = res.body.data[0]
    const res2 = await getVideo(servers[1].url, video.id)
    const videoDetails: VideoDetails = res2.body

    expect(videoDetails.files).to.have.lengthOf(1)

    for (const resolution of [ '240' ]) {
      const path = join(root(), 'test2', 'videos', video.uuid + '-' + resolution + '.mp4')
      const fps = await getVideoFileFPS(path)

      expect(fps).to.be.below(31)
    }
  })

  it('Should wait transcoding before publishing the video', async function () {
    this.timeout(80000)

    await doubleFollow(servers[0], servers[1])

    await waitJobs(servers)

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
      const videoToFindInMine = resMyVideos.body.data.find(v => v.name === 'waiting video')
      expect(videoToFindInMine).not.to.be.undefined
      expect(videoToFindInMine.state.id).to.equal(VideoState.TO_TRANSCODE)
      expect(videoToFindInMine.state.label).to.equal('To transcode')
      expect(videoToFindInMine.waitTranscoding).to.be.true

      // Should not list this video
      const resVideos = await getVideosList(servers[1].url)
      const videoToFindInList = resVideos.body.data.find(v => v.name === 'waiting video')
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
