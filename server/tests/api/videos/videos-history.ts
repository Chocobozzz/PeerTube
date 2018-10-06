/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  flushTests,
  getVideosListWithToken,
  getVideoWithToken,
  killallServers, makePutBodyRequest,
  runServer, searchVideoWithToken,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo
} from '../../utils'
import { Video, VideoDetails } from '../../../../shared/models/videos'
import { userWatchVideo } from '../../utils/videos/video-history'

const expect = chai.expect

describe('Test videos history', function () {
  let server: ServerInfo = null
  let video1UUID: string
  let video2UUID: string
  let video3UUID: string

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    {
      const res = await uploadVideo(server.url, server.accessToken, { name: 'video 1' })
      video1UUID = res.body.video.uuid
    }

    {
      const res = await uploadVideo(server.url, server.accessToken, { name: 'video 2' })
      video2UUID = res.body.video.uuid
    }

    {
      const res = await uploadVideo(server.url, server.accessToken, { name: 'video 3' })
      video3UUID = res.body.video.uuid
    }
  })

  it('Should get videos, without watching history', async function () {
    const res = await getVideosListWithToken(server.url, server.accessToken)
    const videos: Video[] = res.body.data

    for (const video of videos) {
      const resDetail = await getVideoWithToken(server.url, server.accessToken, video.id)
      const videoDetails: VideoDetails = resDetail.body

      expect(video.userHistory).to.be.undefined
      expect(videoDetails.userHistory).to.be.undefined
    }
  })

  it('Should watch the first and second video', async function () {
    await userWatchVideo(server.url, server.accessToken, video1UUID, 3)
    await userWatchVideo(server.url, server.accessToken, video2UUID, 8)
  })

  it('Should return the correct history when listing, searching and getting videos', async function () {
    const videosOfVideos: Video[][] = []

    {
      const res = await getVideosListWithToken(server.url, server.accessToken)
      videosOfVideos.push(res.body.data)
    }

    {
      const res = await searchVideoWithToken(server.url, 'video', server.accessToken)
      videosOfVideos.push(res.body.data)
    }

    for (const videos of videosOfVideos) {
      const video1 = videos.find(v => v.uuid === video1UUID)
      const video2 = videos.find(v => v.uuid === video2UUID)
      const video3 = videos.find(v => v.uuid === video3UUID)

      expect(video1.userHistory).to.not.be.undefined
      expect(video1.userHistory.currentTime).to.equal(3)

      expect(video2.userHistory).to.not.be.undefined
      expect(video2.userHistory.currentTime).to.equal(8)

      expect(video3.userHistory).to.be.undefined
    }

    {
      const resDetail = await getVideoWithToken(server.url, server.accessToken, video1UUID)
      const videoDetails: VideoDetails = resDetail.body

      expect(videoDetails.userHistory).to.not.be.undefined
      expect(videoDetails.userHistory.currentTime).to.equal(3)
    }

    {
      const resDetail = await getVideoWithToken(server.url, server.accessToken, video2UUID)
      const videoDetails: VideoDetails = resDetail.body

      expect(videoDetails.userHistory).to.not.be.undefined
      expect(videoDetails.userHistory.currentTime).to.equal(8)
    }

    {
      const resDetail = await getVideoWithToken(server.url, server.accessToken, video3UUID)
      const videoDetails: VideoDetails = resDetail.body

      expect(videoDetails.userHistory).to.be.undefined
    }
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
