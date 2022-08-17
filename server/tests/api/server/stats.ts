/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@shared/core-utils'
import { ActivityType, VideoPlaylistPrivacy } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  waitJobs
} from '@shared/server-commands'

describe('Test stats (excluding redundancy)', function () {
  let servers: PeerTubeServer[] = []
  let channelId
  const user = {
    username: 'user1',
    password: 'super_password'
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(3)

    await setAccessTokensToServers(servers)
    await setDefaultChannelAvatar(servers)
    await setDefaultAccountAvatar(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].users.create({ username: user.username, password: user.password })

    const { uuid } = await servers[0].videos.upload({ attributes: { fixture: 'video_short.webm' } })

    await servers[0].comments.createThread({ videoId: uuid, text: 'comment' })

    await servers[0].views.simulateView({ id: uuid })

    // Wait the video views repeatable job
    await wait(8000)

    await servers[2].follows.follow({ hosts: [ servers[0].url ] })
    await waitJobs(servers)
  })

  it('Should have the correct stats on instance 1', async function () {
    const data = await servers[0].stats.get()

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
    const data = await servers[1].stats.get()

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
    const data = await servers[2].stats.get()

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

    await servers[2].follows.unfollow({ target: servers[0] })
    await waitJobs(servers)

    const data = await servers[2].stats.get()

    expect(data.totalVideos).to.equal(0)
  })

  it('Should have the correct active user stats', async function () {
    const server = servers[0]

    {
      const data = await server.stats.get()

      expect(data.totalDailyActiveUsers).to.equal(1)
      expect(data.totalWeeklyActiveUsers).to.equal(1)
      expect(data.totalMonthlyActiveUsers).to.equal(1)
    }

    {
      await server.login.getAccessToken(user)

      const data = await server.stats.get()

      expect(data.totalDailyActiveUsers).to.equal(2)
      expect(data.totalWeeklyActiveUsers).to.equal(2)
      expect(data.totalMonthlyActiveUsers).to.equal(2)
    }
  })

  it('Should have the correct active channel stats', async function () {
    const server = servers[0]

    {
      const data = await server.stats.get()

      expect(data.totalLocalDailyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalWeeklyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalMonthlyActiveVideoChannels).to.equal(1)
    }

    {
      const attributes = {
        name: 'stats_channel',
        displayName: 'My stats channel'
      }
      const created = await server.channels.create({ attributes })
      channelId = created.id

      const data = await server.stats.get()

      expect(data.totalLocalDailyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalWeeklyActiveVideoChannels).to.equal(1)
      expect(data.totalLocalMonthlyActiveVideoChannels).to.equal(1)
    }

    {
      await server.videos.upload({ attributes: { fixture: 'video_short.webm', channelId } })

      const data = await server.stats.get()

      expect(data.totalLocalDailyActiveVideoChannels).to.equal(2)
      expect(data.totalLocalWeeklyActiveVideoChannels).to.equal(2)
      expect(data.totalLocalMonthlyActiveVideoChannels).to.equal(2)
    }
  })

  it('Should have the correct playlist stats', async function () {
    const server = servers[0]

    {
      const data = await server.stats.get()
      expect(data.totalLocalPlaylists).to.equal(0)
    }

    {
      await server.playlists.create({
        attributes: {
          displayName: 'playlist for count',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: channelId
        }
      })

      const data = await server.stats.get()
      expect(data.totalLocalPlaylists).to.equal(1)
    }
  })

  it('Should correctly count video file sizes if transcoding is enabled', async function () {
    this.timeout(60000)

    await servers[0].config.updateCustomSubConfig({
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
            '144p': false,
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

    await servers[0].videos.upload({ attributes: { name: 'video', fixture: 'video_short.webm' } })

    await waitJobs(servers)

    {
      const data = await servers[1].stats.get()
      expect(data.totalLocalVideoFilesSize).to.equal(0)
    }

    {
      const data = await servers[0].stats.get()
      expect(data.totalLocalVideoFilesSize).to.be.greaterThan(500000)
      expect(data.totalLocalVideoFilesSize).to.be.lessThan(600000)
    }
  })

  it('Should have the correct AP stats', async function () {
    this.timeout(60000)

    await servers[0].config.disableTranscoding()

    const first = await servers[1].stats.get()

    for (let i = 0; i < 10; i++) {
      await servers[0].videos.upload({ attributes: { name: 'video' } })
    }

    await waitJobs(servers)

    await wait(6000)

    const second = await servers[1].stats.get()
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

    const third = await servers[1].stats.get()
    expect(third.totalActivityPubMessagesWaiting).to.equal(0)
    expect(third.activityPubMessagesProcessedPerSecond).to.be.lessThan(second.activityPubMessagesProcessedPerSecond)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
