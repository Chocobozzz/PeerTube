/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { Video } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test videos history', function () {
  let server: PeerTubeServer = null
  let video1Id: number
  let video1UUID: string
  let video2UUID: string
  let video3UUID: string
  let video3WatchedDate: Date
  let userAccessToken: string

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    // 10 seconds long
    const fixture = 'video_short1.webm'

    {
      const { id, uuid } = await server.videos.upload({ attributes: { name: 'video 1', fixture } })
      video1UUID = uuid
      video1Id = id
    }

    {
      const { uuid } = await server.videos.upload({ attributes: { name: 'video 2', fixture } })
      video2UUID = uuid
    }

    {
      const { uuid } = await server.videos.upload({ attributes: { name: 'video 3', fixture } })
      video3UUID = uuid
    }

    userAccessToken = await server.users.generateUserAndToken('user_1')
  })

  it('Should get videos, without watching history', async function () {
    const { data } = await server.videos.listWithToken()

    for (const video of data) {
      const videoDetails = await server.videos.getWithToken({ id: video.id })

      expect(video.userHistory).to.be.undefined
      expect(videoDetails.userHistory).to.be.undefined
    }
  })

  it('Should watch the first and second video', async function () {
    await server.views.view({ id: video2UUID, token: server.accessToken, currentTime: 8 })
    await server.views.view({ id: video1UUID, token: server.accessToken, currentTime: 3 })
  })

  it('Should return the correct history when listing, searching and getting videos', async function () {
    const videosOfVideos: Video[][] = []

    {
      const { data } = await server.videos.listWithToken()
      videosOfVideos.push(data)
    }

    {
      const body = await server.search.searchVideos({ token: server.accessToken, search: 'video' })
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
      const videoDetails = await server.videos.getWithToken({ id: video1UUID })

      expect(videoDetails.userHistory).to.not.be.undefined
      expect(videoDetails.userHistory.currentTime).to.equal(3)
    }

    {
      const videoDetails = await server.videos.getWithToken({ id: video2UUID })

      expect(videoDetails.userHistory).to.not.be.undefined
      expect(videoDetails.userHistory.currentTime).to.equal(8)
    }

    {
      const videoDetails = await server.videos.getWithToken({ id: video3UUID })

      expect(videoDetails.userHistory).to.be.undefined
    }
  })

  it('Should have these videos when listing my history', async function () {
    video3WatchedDate = new Date()
    await server.views.view({ id: video3UUID, token: server.accessToken, currentTime: 2 })

    const body = await server.history.list()

    expect(body.total).to.equal(3)

    const videos = body.data
    expect(videos[0].name).to.equal('video 3')
    expect(videos[1].name).to.equal('video 1')
    expect(videos[2].name).to.equal('video 2')
  })

  it('Should not have videos history on another user', async function () {
    const body = await server.history.list({ token: userAccessToken })

    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  it('Should be able to search through videos in my history', async function () {
    const body = await server.history.list({ search: '2' })
    expect(body.total).to.equal(1)

    const videos = body.data
    expect(videos[0].name).to.equal('video 2')
  })

  it('Should clear my history', async function () {
    await server.history.removeAll({ beforeDate: video3WatchedDate.toISOString() })
  })

  it('Should have my history cleared', async function () {
    const body = await server.history.list()
    expect(body.total).to.equal(1)

    const videos = body.data
    expect(videos[0].name).to.equal('video 3')
  })

  it('Should disable videos history', async function () {
    await server.users.updateMe({
      videosHistoryEnabled: false
    })

    await server.views.view({ id: video2UUID, token: server.accessToken, currentTime: 8 })

    const { data } = await server.history.list()
    expect(data[0].name).to.not.equal('video 2')
  })

  it('Should re-enable videos history', async function () {
    await server.users.updateMe({
      videosHistoryEnabled: true
    })

    await server.views.view({ id: video2UUID, token: server.accessToken, currentTime: 8 })

    const { data } = await server.history.list()
    expect(data[0].name).to.equal('video 2')
  })

  it('Should not clean old history', async function () {
    this.timeout(50000)

    await killallServers([ server ])

    await server.run({ history: { videos: { max_age: '10 days' } } })

    await wait(6000)

    // Should still have history

    const body = await server.history.list()
    expect(body.total).to.equal(2)
  })

  it('Should clean old history', async function () {
    this.timeout(50000)

    await killallServers([ server ])

    await server.run({ history: { videos: { max_age: '5 seconds' } } })

    await wait(6000)

    const body = await server.history.list()
    expect(body.total).to.equal(0)
  })

  it('Should delete a specific history element', async function () {
    {
      await server.views.view({ id: video1UUID, token: server.accessToken, currentTime: 4 })
      await server.views.view({ id: video2UUID, token: server.accessToken, currentTime: 8 })
    }

    {
      const body = await server.history.list()
      expect(body.total).to.equal(2)
    }

    {
      await server.history.removeElement({ videoId: video1Id })

      const body = await server.history.list()
      expect(body.total).to.equal(1)
      expect(body.data[0].uuid).to.equal(video2UUID)
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
