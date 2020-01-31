/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  createUser,
  flushAndRunServer,
  getVideosListWithToken,
  getVideoWithToken,
  killallServers,
  reRunServer,
  searchVideoWithToken,
  ServerInfo,
  setAccessTokensToServers,
  updateMyUser,
  uploadVideo,
  userLogin,
  wait
} from '../../../../shared/extra-utils'
import { Video, VideoDetails } from '../../../../shared/models/videos'
import { listMyVideosHistory, removeMyVideosHistory, userWatchVideo } from '../../../../shared/extra-utils/videos/video-history'

const expect = chai.expect

describe('Test videos history', function () {
  let server: ServerInfo = null
  let video1UUID: string
  let video2UUID: string
  let video3UUID: string
  let video3WatchedDate: Date
  let userAccessToken: string

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

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

    const user = {
      username: 'user_1',
      password: 'super password'
    }
    await createUser({ url: server.url, accessToken: server.accessToken, username: user.username, password: user.password })
    userAccessToken = await userLogin(server, user)
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
    await userWatchVideo(server.url, server.accessToken, video2UUID, 8)
    await userWatchVideo(server.url, server.accessToken, video1UUID, 3)
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

  it('Should have these videos when listing my history', async function () {
    video3WatchedDate = new Date()
    await userWatchVideo(server.url, server.accessToken, video3UUID, 2)

    const res = await listMyVideosHistory(server.url, server.accessToken)

    expect(res.body.total).to.equal(3)

    const videos: Video[] = res.body.data
    expect(videos[0].name).to.equal('video 3')
    expect(videos[1].name).to.equal('video 1')
    expect(videos[2].name).to.equal('video 2')
  })

  it('Should not have videos history on another user', async function () {
    const res = await listMyVideosHistory(server.url, userAccessToken)

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should clear my history', async function () {
    await removeMyVideosHistory(server.url, server.accessToken, video3WatchedDate.toISOString())
  })

  it('Should have my history cleared', async function () {
    const res = await listMyVideosHistory(server.url, server.accessToken)

    expect(res.body.total).to.equal(1)

    const videos: Video[] = res.body.data
    expect(videos[0].name).to.equal('video 3')
  })

  it('Should disable videos history', async function () {
    await updateMyUser({
      url: server.url,
      accessToken: server.accessToken,
      videosHistoryEnabled: false
    })

    await userWatchVideo(server.url, server.accessToken, video2UUID, 8, 409)
  })

  it('Should re-enable videos history', async function () {
    await updateMyUser({
      url: server.url,
      accessToken: server.accessToken,
      videosHistoryEnabled: true
    })

    await userWatchVideo(server.url, server.accessToken, video1UUID, 8)

    const res = await listMyVideosHistory(server.url, server.accessToken)

    expect(res.body.total).to.equal(2)

    const videos: Video[] = res.body.data
    expect(videos[0].name).to.equal('video 1')
    expect(videos[1].name).to.equal('video 3')
  })

  it('Should not clean old history', async function () {
    this.timeout(50000)

    killallServers([ server ])

    await reRunServer(server, { history: { videos: { max_age: '10 days' } } })

    await wait(6000)

    // Should still have history

    const res = await listMyVideosHistory(server.url, server.accessToken)

    expect(res.body.total).to.equal(2)
  })

  it('Should clean old history', async function () {
    this.timeout(50000)

    killallServers([ server ])

    await reRunServer(server, { history: { videos: { max_age: '5 seconds' } } })

    await wait(6000)

    const res = await listMyVideosHistory(server.url, server.accessToken)
    expect(res.body.total).to.equal(0)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
