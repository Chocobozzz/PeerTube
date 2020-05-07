/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { ServerStats } from '../../../../shared/models/server/server-stats.model'
import {
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  follow,
  ServerInfo, unfollow,
  uploadVideo,
  viewVideo,
  wait,
  userLogin
} from '../../../../shared/extra-utils'
import { setAccessTokensToServers } from '../../../../shared/extra-utils/index'
import { getStats } from '../../../../shared/extra-utils/server/stats'
import { addVideoCommentThread } from '../../../../shared/extra-utils/videos/video-comments'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'

const expect = chai.expect

describe('Test stats (excluding redundancy)', function () {
  let servers: ServerInfo[] = []
  const user = {
    username: 'user1',
    password: 'super_password'
  }

  before(async function () {
    this.timeout(60000)
    servers = await flushAndRunMultipleServers(3)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username: user.username, password: user.password })

    const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { fixture: 'video_short.webm' })
    const videoUUID = resVideo.body.video.uuid

    await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, 'comment')

    await viewVideo(servers[0].url, videoUUID)

    // Wait the video views repeatable job
    await wait(8000)

    await follow(servers[2].url, [ servers[0].url ], servers[2].accessToken)
    await waitJobs(servers)
  })

  it('Should have the correct stats on instance 1', async function () {
    const res = await getStats(servers[0].url)
    const data: ServerStats = res.body

    expect(data.totalLocalVideoComments).to.equal(1)
    expect(data.totalLocalVideos).to.equal(1)
    expect(data.totalLocalVideoViews).to.equal(1)
    expect(data.totalLocalVideoFilesSize).to.equal(218910)
    expect(data.totalUsers).to.equal(2)
    expect(data.totalVideoComments).to.equal(1)
    expect(data.totalVideos).to.equal(1)
    expect(data.totalInstanceFollowers).to.equal(2)
    expect(data.totalInstanceFollowing).to.equal(1)
  })

  it('Should have the correct stats on instance 2', async function () {
    const res = await getStats(servers[1].url)
    const data: ServerStats = res.body

    expect(data.totalLocalVideoComments).to.equal(0)
    expect(data.totalLocalVideos).to.equal(0)
    expect(data.totalLocalVideoViews).to.equal(0)
    expect(data.totalLocalVideoFilesSize).to.equal(0)
    expect(data.totalUsers).to.equal(1)
    expect(data.totalVideoComments).to.equal(1)
    expect(data.totalVideos).to.equal(1)
    expect(data.totalInstanceFollowers).to.equal(1)
    expect(data.totalInstanceFollowing).to.equal(1)
  })

  it('Should have the correct stats on instance 3', async function () {
    const res = await getStats(servers[2].url)
    const data: ServerStats = res.body

    expect(data.totalLocalVideoComments).to.equal(0)
    expect(data.totalLocalVideos).to.equal(0)
    expect(data.totalLocalVideoViews).to.equal(0)
    expect(data.totalUsers).to.equal(1)
    expect(data.totalVideoComments).to.equal(1)
    expect(data.totalVideos).to.equal(1)
    expect(data.totalInstanceFollowing).to.equal(1)
    expect(data.totalInstanceFollowers).to.equal(0)
  })

  it('Should have the correct total videos stats after an unfollow', async function () {
    this.timeout(15000)

    await unfollow(servers[2].url, servers[2].accessToken, servers[0])
    await waitJobs(servers)

    const res = await getStats(servers[2].url)
    const data: ServerStats = res.body

    expect(data.totalVideos).to.equal(0)
  })

  it('Should have the correct active users stats', async function () {
    const server = servers[0]

    {
      const res = await getStats(server.url)
      const data: ServerStats = res.body
      expect(data.totalDailyActiveUsers).to.equal(1)
      expect(data.totalWeeklyActiveUsers).to.equal(1)
      expect(data.totalMonthlyActiveUsers).to.equal(1)
    }

    {
      await userLogin(server, user)

      const res = await getStats(server.url)
      const data: ServerStats = res.body
      expect(data.totalDailyActiveUsers).to.equal(2)
      expect(data.totalWeeklyActiveUsers).to.equal(2)
      expect(data.totalMonthlyActiveUsers).to.equal(2)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
