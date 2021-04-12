/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  addVideoChannel,
  cleanupTests,
  createUser,
  createVideoPlaylist,
  doubleFollow,
  flushAndRunMultipleServers,
  follow,
  ServerInfo,
  unfollow,
  updateCustomSubConfig,
  uploadVideo,
  userLogin,
  viewVideo,
  wait
} from '../../../../shared/extra-utils'
import { setAccessTokensToServers } from '../../../../shared/extra-utils/index'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { getStats } from '../../../../shared/extra-utils/server/stats'
import { addVideoCommentThread } from '../../../../shared/extra-utils/videos/video-comments'
import { ServerStats } from '../../../../shared/models/server/server-stats.model'
import { VideoPlaylistPrivacy } from '../../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { ActivityType } from '@shared/models'

const expect = chai.expect

describe('Test stats (excluding redundancy)', function () {
  let servers: ServerInfo[] = []
  let channelId
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
    expect(data.totalLocalPlaylists).to.equal(0)
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
    expect(data.totalLocalPlaylists).to.equal(0)
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
    expect(data.totalLocalPlaylists).to.equal(0)
  })

  it('Should have the correct total videos stats after an unfollow', async function () {
    this.timeout(15000)

    await unfollow(servers[2].url, servers[2].accessToken, servers[0])
    await waitJobs(servers)

    const res = await getStats(servers[2].url)
    const data: ServerStats = res.body

    expect(data.totalVideos).to.equal(0)
  })

  it('Should have the correct active user stats', async function () {
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

  it('Should have the correct active channel stats', async function () {
    const server = servers[0]

    {
      const res = await getStats(server.url)
      const data: ServerStats = res.body
      expect(data.totalLocalDailyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalWeeklyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalMonthlyActiveVideoChannels).to.equal(1)
    }

    {
      const channelAttributes = {
        name: 'stats_channel',
        displayName: 'My stats channel'
      }
      const resChannel = await addVideoChannel(server.url, server.accessToken, channelAttributes)
      channelId = resChannel.body.videoChannel.id

      const res = await getStats(server.url)
      const data: ServerStats = res.body
      expect(data.totalLocalDailyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalWeeklyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalMonthlyActiveVideoChannels).to.equal(1)
    }

    {
      await uploadVideo(server.url, server.accessToken, { fixture: 'video_short.webm', channelId })

      const res = await getStats(server.url)
      const data: ServerStats = res.body
      expect(data.totalLocalDailyActiveVideoChannels).to.equal(2)
      expect(data.totalLocalWeeklyActiveVideoChannels).to.equal(2)
      expect(data.totalLocalMonthlyActiveVideoChannels).to.equal(2)
    }
  })

  it('Should have the correct playlist stats', async function () {
    const server = servers[0]

    {
      const resStats = await getStats(server.url)
      const dataStats: ServerStats = resStats.body
      expect(dataStats.totalLocalPlaylists).to.equal(0)
    }

    {
      await createVideoPlaylist({
        url: server.url,
        token: server.accessToken,
        playlistAttrs: {
          displayName: 'playlist for count',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: channelId
        }
      })

      const resStats = await getStats(server.url)
      const dataStats: ServerStats = resStats.body
      expect(dataStats.totalLocalPlaylists).to.equal(1)
    }
  })

  it('Should correctly count video file sizes if transcoding is enabled', async function () {
    this.timeout(60000)

    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
      transcoding: {
        enabled: true,
        webtorrent: {
          enabled: true
        },
        hls: {
          enabled: true
        },
        resolutions: {
          '0p': false,
          '240p': false,
          '360p': false,
          '480p': false,
          '720p': false,
          '1080p': false,
          '1440p': false,
          '2160p': false
        }
      }
    })

    await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video', fixture: 'video_short.webm' })

    await waitJobs(servers)

    {
      const res = await getStats(servers[1].url)
      const data: ServerStats = res.body
      expect(data.totalLocalVideoFilesSize).to.equal(0)
    }

    {
      const res = await getStats(servers[0].url)
      const data: ServerStats = res.body
      expect(data.totalLocalVideoFilesSize).to.be.greaterThan(500000)
      expect(data.totalLocalVideoFilesSize).to.be.lessThan(600000)
    }
  })

  it('Should have the correct AP stats', async function () {
    this.timeout(60000)

    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, {
      transcoding: {
        enabled: false
      }
    })

    const res1 = await getStats(servers[1].url)
    const first = res1.body as ServerStats

    for (let i = 0; i < 10; i++) {
      await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video' })
    }

    await waitJobs(servers)

    await wait(6000)

    const res2 = await getStats(servers[1].url)
    const second: ServerStats = res2.body

    expect(second.totalActivityPubMessagesProcessed).to.be.greaterThan(first.totalActivityPubMessagesProcessed)
    const apTypes: ActivityType[] = [
      'Create', 'Update', 'Delete', 'Follow', 'Accept', 'Announce', 'Undo', 'Like', 'Reject', 'View', 'Dislike', 'Flag'
    ]

    const processed = apTypes.reduce(
      (previous, type) => previous + second['totalActivityPub' + type + 'MessagesSuccesses'],
      0
    )
    expect(second.totalActivityPubMessagesProcessed).to.equal(processed)
    expect(second.totalActivityPubMessagesSuccesses).to.equal(processed)

    expect(second.totalActivityPubMessagesErrors).to.equal(0)

    for (const apType of apTypes) {
      expect(second['totalActivityPub' + apType + 'MessagesErrors']).to.equal(0)
    }

    await wait(6000)

    const res3 = await getStats(servers[1].url)
    const third: ServerStats = res3.body

    expect(third.totalActivityPubMessagesWaiting).to.equal(0)
    expect(third.activityPubMessagesProcessedPerSecond).to.be.lessThan(second.activityPubMessagesProcessedPerSecond)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
