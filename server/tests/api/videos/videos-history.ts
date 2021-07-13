/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { HttpStatusCode } from '@shared/core-utils'
import {
  cleanupTests,
  createUser,
  flushAndRunServer,
  getVideosListWithToken,
  getVideoWithToken,
  HistoryCommand,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  updateMyUser,
  uploadVideo,
  wait
} from '@shared/extra-utils'
import { Video, VideoDetails } from '@shared/models'

const expect = chai.expect

describe('Test videos history', function () {
  let server: ServerInfo = null
  let video1UUID: string
  let video2UUID: string
  let video3UUID: string
  let video3WatchedDate: Date
  let userAccessToken: string
  let command: HistoryCommand

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])

    command = server.historyCommand

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
    userAccessToken = await server.loginCommand.getAccessToken(user)
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
    await command.wathVideo({ videoId: video2UUID, currentTime: 8 })
    await command.wathVideo({ videoId: video1UUID, currentTime: 3 })
  })

  it('Should return the correct history when listing, searching and getting videos', async function () {
    const videosOfVideos: Video[][] = []

    {
      const res = await getVideosListWithToken(server.url, server.accessToken)
      videosOfVideos.push(res.body.data)
    }

    {
      const body = await server.searchCommand.searchVideos({ token: server.accessToken, search: 'video' })
      videosOfVideos.push(body.data)
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
    await command.wathVideo({ videoId: video3UUID, currentTime: 2 })

    const body = await command.list()

    expect(body.total).to.equal(3)

    const videos = body.data
    expect(videos[0].name).to.equal('video 3')
    expect(videos[1].name).to.equal('video 1')
    expect(videos[2].name).to.equal('video 2')
  })

  it('Should not have videos history on another user', async function () {
    const body = await command.list({ token: userAccessToken })

    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  it('Should be able to search through videos in my history', async function () {
    const body = await command.list({ search: '2' })
    expect(body.total).to.equal(1)

    const videos = body.data
    expect(videos[0].name).to.equal('video 2')
  })

  it('Should clear my history', async function () {
    await command.remove({ beforeDate: video3WatchedDate.toISOString() })
  })

  it('Should have my history cleared', async function () {
    const body = await command.list()
    expect(body.total).to.equal(1)

    const videos = body.data
    expect(videos[0].name).to.equal('video 3')
  })

  it('Should disable videos history', async function () {
    await updateMyUser({
      url: server.url,
      accessToken: server.accessToken,
      videosHistoryEnabled: false
    })

    await command.wathVideo({ videoId: video2UUID, currentTime: 8, expectedStatus: HttpStatusCode.CONFLICT_409 })
  })

  it('Should re-enable videos history', async function () {
    await updateMyUser({
      url: server.url,
      accessToken: server.accessToken,
      videosHistoryEnabled: true
    })

    await command.wathVideo({ videoId: video1UUID, currentTime: 8 })

    const body = await command.list()
    expect(body.total).to.equal(2)

    const videos = body.data
    expect(videos[0].name).to.equal('video 1')
    expect(videos[1].name).to.equal('video 3')
  })

  it('Should not clean old history', async function () {
    this.timeout(50000)

    await killallServers([ server ])

    await reRunServer(server, { history: { videos: { max_age: '10 days' } } })

    await wait(6000)

    // Should still have history

    const body = await command.list()
    expect(body.total).to.equal(2)
  })

  it('Should clean old history', async function () {
    this.timeout(50000)

    await killallServers([ server ])

    await reRunServer(server, { history: { videos: { max_age: '5 seconds' } } })

    await wait(6000)

    const body = await command.list()
    expect(body.total).to.equal(0)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
