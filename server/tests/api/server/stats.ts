/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  userLogin,
  viewVideo,
  wait,
  waitJobs
} from '@shared/extra-utils'
import { ActivityType, VideoPlaylistPrivacy } from '@shared/models'

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

    await servers[0].commentsCommand.createThread({ videoId: videoUUID, text: 'comment' })

    await viewVideo(servers[0].url, videoUUID)

    // Wait the video views repeatable job
    await wait(8000)

    await servers[2].followsCommand.follow({ targets: [ servers[0].url ] })
    await waitJobs(servers)
  })

  it('Should have the correct stats on instance 1', async function () {
    const data = await servers[0].statsCommand.get()

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
    const data = await servers[1].statsCommand.get()

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
    const data = await servers[2].statsCommand.get()

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

    await servers[2].followsCommand.unfollow({ target: servers[0] })
    await waitJobs(servers)

    const data = await servers[2].statsCommand.get()

    expect(data.totalVideos).to.equal(0)
  })

  it('Should have the correct active user stats', async function () {
    const server = servers[0]

    {
      const data = await server.statsCommand.get()

      expect(data.totalDailyActiveUsers).to.equal(1)
      expect(data.totalWeeklyActiveUsers).to.equal(1)
      expect(data.totalMonthlyActiveUsers).to.equal(1)
    }

    {
      await userLogin(server, user)

      const data = await server.statsCommand.get()

      expect(data.totalDailyActiveUsers).to.equal(2)
      expect(data.totalWeeklyActiveUsers).to.equal(2)
      expect(data.totalMonthlyActiveUsers).to.equal(2)
    }
  })

  it('Should have the correct active channel stats', async function () {
    const server = servers[0]

    {
      const data = await server.statsCommand.get()

      expect(data.totalLocalDailyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalWeeklyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalMonthlyActiveVideoChannels).to.equal(1)
    }

    {
      const attributes = {
        name: 'stats_channel',
        displayName: 'My stats channel'
      }
      const created = await server.channelsCommand.create({ attributes })
      channelId = created.id

      const data = await server.statsCommand.get()

      expect(data.totalLocalDailyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalWeeklyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalMonthlyActiveVideoChannels).to.equal(1)
    }

    {
      await uploadVideo(server.url, server.accessToken, { fixture: 'video_short.webm', channelId })

      const data = await server.statsCommand.get()

      expect(data.totalLocalDailyActiveVideoChannels).to.equal(2)
      expect(data.totalLocalWeeklyActiveVideoChannels).to.equal(2)
      expect(data.totalLocalMonthlyActiveVideoChannels).to.equal(2)
    }
  })

  it('Should have the correct playlist stats', async function () {
    const server = servers[0]

    {
      const data = await server.statsCommand.get()
      expect(data.totalLocalPlaylists).to.equal(0)
    }

    {
      await server.playlistsCommand.create({
        attributes: {
          displayName: 'playlist for count',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: channelId
        }
      })

      const data = await server.statsCommand.get()
      expect(data.totalLocalPlaylists).to.equal(1)
    }
  })

  it('Should correctly count video file sizes if transcoding is enabled', async function () {
    this.timeout(60000)

    await servers[0].configCommand.updateCustomSubConfig({
      newConfig: {
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
      }
    })

    await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video', fixture: 'video_short.webm' })

    await waitJobs(servers)

    {
      const data = await servers[1].statsCommand.get()
      expect(data.totalLocalVideoFilesSize).to.equal(0)
    }

    {
      const data = await servers[0].statsCommand.get()
      expect(data.totalLocalVideoFilesSize).to.be.greaterThan(500000)
      expect(data.totalLocalVideoFilesSize).to.be.lessThan(600000)
    }
  })

  it('Should have the correct AP stats', async function () {
    this.timeout(60000)

    await servers[0].configCommand.updateCustomSubConfig({
      newConfig: {
        transcoding: {
          enabled: false
        }
      }
    })

    const first = await servers[1].statsCommand.get()

    for (let i = 0; i < 10; i++) {
      await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video' })
    }

    await waitJobs(servers)

    await wait(6000)

    const second = await servers[1].statsCommand.get()
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

    const third = await servers[1].statsCommand.get()
    expect(third.totalActivityPubMessagesWaiting).to.equal(0)
    expect(third.activityPubMessagesProcessedPerSecond).to.be.lessThan(second.activityPubMessagesProcessedPerSecond)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
