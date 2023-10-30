/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

function in15Seconds () {
  const now = new Date()
  now.setSeconds(now.getSeconds() + 15)

  return now
}

describe('Test video update scheduler', function () {
  let servers: PeerTubeServer[] = []
  let video2UUID: string

  before(async function () {
    this.timeout(120000)

    // Run servers
    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])
  })

  it('Should upload a video and schedule an update in 10 seconds', async function () {
    const attributes = {
      name: 'video 1',
      privacy: VideoPrivacy.PRIVATE,
      scheduleUpdate: {
        updateAt: in15Seconds().toISOString(),
        privacy: VideoPrivacy.PUBLIC
      }
    }

    await servers[0].videos.upload({ attributes })

    await waitJobs(servers)
  })

  it('Should not list the video (in privacy mode)', async function () {
    for (const server of servers) {
      const { total } = await server.videos.list()

      expect(total).to.equal(0)
    }
  })

  it('Should have my scheduled video in my account videos', async function () {
    const { total, data } = await servers[0].videos.listMyVideos()
    expect(total).to.equal(1)

    const videoFromList = data[0]
    const videoFromGet = await servers[0].videos.getWithToken({ id: videoFromList.uuid })

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
      const { total, data } = await server.videos.list()

      expect(total).to.equal(1)
      expect(data[0].name).to.equal('video 1')
    }
  })

  it('Should upload a video without scheduling an update', async function () {
    const attributes = {
      name: 'video 2',
      privacy: VideoPrivacy.PRIVATE
    }

    const { uuid } = await servers[0].videos.upload({ attributes })
    video2UUID = uuid

    await waitJobs(servers)
  })

  it('Should update a video by scheduling an update', async function () {
    const attributes = {
      name: 'video 2 updated',
      scheduleUpdate: {
        updateAt: in15Seconds().toISOString(),
        privacy: VideoPrivacy.PUBLIC
      }
    }

    await servers[0].videos.update({ id: video2UUID, attributes })
    await waitJobs(servers)
  })

  it('Should not display the updated video', async function () {
    for (const server of servers) {
      const { total } = await server.videos.list()

      expect(total).to.equal(1)
    }
  })

  it('Should have my scheduled updated video in my account videos', async function () {
    const { total, data } = await servers[0].videos.listMyVideos()
    expect(total).to.equal(2)

    const video = data.find(v => v.uuid === video2UUID)
    expect(video).not.to.be.undefined

    expect(video.name).to.equal('video 2 updated')
    expect(video.privacy.id).to.equal(VideoPrivacy.PRIVATE)

    expect(new Date(video.scheduledUpdate.updateAt)).to.be.above(new Date())
    expect(video.scheduledUpdate.privacy).to.equal(VideoPrivacy.PUBLIC)
  })

  it('Should wait some seconds and have the updated video in public privacy', async function () {
    this.timeout(45000)

    let total = 0
    do {
      const res = await servers[0].videos.list()
      total = res.total

      await wait(500)
    } while (total !== 2)

    await waitJobs(servers)

    for (const server of servers) {
      const { total, data } = await server.videos.list()
      expect(total).to.equal(2)

      const video = data.find(v => v.uuid === video2UUID)
      expect(video).not.to.be.undefined
      expect(video.name).to.equal('video 2 updated')
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
