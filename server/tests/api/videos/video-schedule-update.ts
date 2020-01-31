/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { VideoPrivacy } from '../../../../shared/models/videos'
import {
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  getMyVideos,
  getVideosList,
  getVideoWithToken,
  ServerInfo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo,
  wait
} from '../../../../shared/extra-utils'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'

const expect = chai.expect

function in10Seconds () {
  const now = new Date()
  now.setSeconds(now.getSeconds() + 10)

  return now
}

describe('Test video update scheduler', function () {
  let servers: ServerInfo[] = []
  let video2UUID: string

  before(async function () {
    this.timeout(30000)

    // Run servers
    servers = await flushAndRunMultipleServers(2)

    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])
  })

  it('Should upload a video and schedule an update in 10 seconds', async function () {
    this.timeout(10000)

    const videoAttributes = {
      name: 'video 1',
      privacy: VideoPrivacy.PRIVATE,
      scheduleUpdate: {
        updateAt: in10Seconds().toISOString(),
        privacy: VideoPrivacy.PUBLIC
      }
    }

    await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

    await waitJobs(servers)
  })

  it('Should not list the video (in privacy mode)', async function () {
    for (const server of servers) {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(0)
    }
  })

  it('Should have my scheduled video in my account videos', async function () {
    const res = await getMyVideos(servers[0].url, servers[0].accessToken, 0, 5)
    expect(res.body.total).to.equal(1)

    const videoFromList = res.body.data[0]
    const res2 = await getVideoWithToken(servers[0].url, servers[0].accessToken, videoFromList.uuid)
    const videoFromGet = res2.body

    for (const video of [ videoFromList, videoFromGet ]) {
      expect(video.name).to.equal('video 1')
      expect(video.privacy.id).to.equal(VideoPrivacy.PRIVATE)
      expect(new Date(video.scheduledUpdate.updateAt)).to.be.above(new Date())
      expect(video.scheduledUpdate.privacy).to.equal(VideoPrivacy.PUBLIC)
    }
  })

  it('Should wait some seconds and have the video in public privacy', async function () {
    this.timeout(50000)

    await wait(15000)
    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(1)
      expect(res.body.data[0].name).to.equal('video 1')
    }
  })

  it('Should upload a video without scheduling an update', async function () {
    this.timeout(10000)

    const videoAttributes = {
      name: 'video 2',
      privacy: VideoPrivacy.PRIVATE
    }

    const res = await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)
    video2UUID = res.body.video.uuid

    await waitJobs(servers)
  })

  it('Should update a video by scheduling an update', async function () {
    this.timeout(10000)

    const videoAttributes = {
      name: 'video 2 updated',
      scheduleUpdate: {
        updateAt: in10Seconds().toISOString(),
        privacy: VideoPrivacy.PUBLIC
      }
    }

    await updateVideo(servers[0].url, servers[0].accessToken, video2UUID, videoAttributes)
    await waitJobs(servers)
  })

  it('Should not display the updated video', async function () {
    for (const server of servers) {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(1)
    }
  })

  it('Should have my scheduled updated video in my account videos', async function () {
    const res = await getMyVideos(servers[0].url, servers[0].accessToken, 0, 5)
    expect(res.body.total).to.equal(2)

    const video = res.body.data.find(v => v.uuid === video2UUID)
    expect(video).not.to.be.undefined

    expect(video.name).to.equal('video 2 updated')
    expect(video.privacy.id).to.equal(VideoPrivacy.PRIVATE)

    expect(new Date(video.scheduledUpdate.updateAt)).to.be.above(new Date())
    expect(video.scheduledUpdate.privacy).to.equal(VideoPrivacy.PUBLIC)
  })

  it('Should wait some seconds and have the updated video in public privacy', async function () {
    this.timeout(20000)

    await wait(15000)
    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(2)

      const video = res.body.data.find(v => v.uuid === video2UUID)
      expect(video).not.to.be.undefined
      expect(video.name).to.equal('video 2 updated')
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
