/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { AbuseState, ActivityType, VideoPlaylistPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test stats (excluding redundancy)', function () {
  let servers: PeerTubeServer[] = []
  let channelId
  const user = { username: 'user1', password: 'super_password' }
  let userAccountId: number

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(3)

    await setAccessTokensToServers(servers)
    await setDefaultChannelAvatar(servers)
    await setDefaultAccountAvatar(servers)

    await doubleFollow(servers[0], servers[1])

    const { account } = await servers[0].users.create({ username: user.username, password: user.password })
    userAccountId = account.id

    const { uuid } = await servers[0].videos.upload({ attributes: { fixture: 'video_short.webm' } })

    await servers[0].comments.createThread({ videoId: uuid, text: 'comment' })

    await servers[0].views.simulateView({ id: uuid })

    // Wait the video views repeatable job
    await wait(8000)

    await servers[2].follows.follow({ hosts: [ servers[0].url ] })
    await waitJobs(servers)
  })

  describe('Total stats', function () {

    it('Should have the correct stats on instance 1', async function () {
      const data = await servers[0].stats.get()

      expect(data.totalLocalVideoComments).to.equal(1)
      expect(data.totalLocalVideos).to.equal(1)
      expect(data.totalLocalVideoViews).to.equal(1)
      expect(data.totalLocalVideoFilesSize).to.equal(218910)

      expect(data.totalUsers).to.equal(2)
      expect(data.totalModerators).to.equal(0)
      expect(data.totalAdmins).to.equal(1)

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
      expect(data.totalModerators).to.equal(0)
      expect(data.totalAdmins).to.equal(1)

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
      expect(data.totalModerators).to.equal(0)
      expect(data.totalAdmins).to.equal(1)

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

        expect(data.totalLocalVideoChannels).to.equal(2)
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

        expect(data.totalLocalVideoChannels).to.equal(3)
        expect(data.totalLocalDailyActiveVideoChannels).to.equal(1)
        expect(data.totalLocalWeeklyActiveVideoChannels).to.equal(1)
        expect(data.totalLocalMonthlyActiveVideoChannels).to.equal(1)
      }

      {
        await server.videos.upload({ attributes: { fixture: 'video_short.webm', channelId } })

        const data = await server.stats.get()

        expect(data.totalLocalVideoChannels).to.equal(3)
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
  })

  describe('File sizes', function () {

    it('Should correctly count video file sizes if transcoding is enabled', async function () {
      this.timeout(120000)

      await servers[0].config.updateExistingConfig({
        newConfig: {
          transcoding: {
            enabled: true,
            webVideos: {
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
  })

  describe('ActivityPub', function () {

    it('Should have the correct AP stats', async function () {
      this.timeout(240000)

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
  })

  describe('User registration requests stats', function () {
    let id2: number
    let beforeTimestamp: number
    let lastResponseTime: number

    before(async function () {
      await servers[0].config.enableSignup(true)
    })

    it('Should not have registration requests stats available', async function () {
      const data = await servers[0].stats.get()

      expect(data.totalRegistrationRequests).to.equal(0)
      expect(data.totalRegistrationRequestsProcessed).to.equal(0)
      expect(data.averageRegistrationRequestResponseTimeMs).to.be.null
    })

    it('Should create registration requests, accept one and have correct stats', async function () {
      beforeTimestamp = new Date().getTime()

      const { id: id1 } = await servers[0].registrations.requestRegistration({ username: 'user2', registrationReason: 'reason 1' });
      ({ id: id2 } = await servers[0].registrations.requestRegistration({ username: 'user3', registrationReason: 'reason 2' }))
      await servers[0].registrations.requestRegistration({ username: 'user4', registrationReason: 'reason 3' })

      await wait(1500)

      await servers[0].registrations.accept({ id: id1, moderationResponse: 'thanks' })

      const middleTimestamp = new Date().getTime()

      {
        const data = await servers[0].stats.get()

        expect(data.totalRegistrationRequests).to.equal(3)
        expect(data.totalRegistrationRequestsProcessed).to.equal(1)

        expect(data.averageRegistrationRequestResponseTimeMs).to.be.greaterThan(1000)
        expect(data.averageRegistrationRequestResponseTimeMs).to.be.below(middleTimestamp - beforeTimestamp)

        lastResponseTime = data.averageRegistrationRequestResponseTimeMs
      }
    })

    it('Should accept another request and update stats', async function () {
      await wait(1500)

      await servers[0].registrations.accept({ id: id2, moderationResponse: 'thanks' })

      const lastTimestamp = new Date().getTime()

      {
        const data = await servers[0].stats.get()

        expect(data.totalRegistrationRequests).to.equal(3)
        expect(data.totalRegistrationRequestsProcessed).to.equal(2)

        expect(data.averageRegistrationRequestResponseTimeMs).to.be.greaterThan(lastResponseTime)
        expect(data.averageRegistrationRequestResponseTimeMs).to.be.below(lastTimestamp - beforeTimestamp)
      }
    })
  })

  describe('Abuses stats', function () {
    let abuse2: number
    let videoId: number
    let commentId: number
    let beforeTimestamp: number
    let lastResponseTime: number
    let userToken: string

    before(async function () {
      userToken = await servers[0].users.generateUserAndToken('reporter');

      ({ id: videoId } = await servers[0].videos.quickUpload({ name: 'to_report' }));
      ({ id: commentId } = await servers[0].comments.createThread({ videoId, text: 'text' }))
    })

    it('Should not abuses stats available', async function () {
      const data = await servers[0].stats.get()

      expect(data.totalAbuses).to.equal(0)
      expect(data.totalAbusesProcessed).to.equal(0)
      expect(data.averageAbuseResponseTimeMs).to.be.null
    })

    it('Should create abuses, process one and have correct stats', async function () {
      beforeTimestamp = new Date().getTime()

      const { abuse: abuse1 } = await servers[0].abuses.report({ videoId, token: userToken, reason: 'abuse reason' });
      ({ abuse: { id: abuse2 } } = await servers[0].abuses.report({ accountId: userAccountId, token: userToken, reason: 'abuse reason' }))
      await servers[0].abuses.report({ commentId, token: userToken, reason: 'abuse reason' })

      await wait(1500)

      await servers[0].abuses.update({ abuseId: abuse1.id, body: { state: AbuseState.REJECTED } })

      const middleTimestamp = new Date().getTime()

      {
        const data = await servers[0].stats.get()

        expect(data.totalAbuses).to.equal(3)
        expect(data.totalAbusesProcessed).to.equal(1)

        expect(data.averageAbuseResponseTimeMs).to.be.greaterThan(1000)
        expect(data.averageAbuseResponseTimeMs).to.be.below(middleTimestamp - beforeTimestamp)

        lastResponseTime = data.averageAbuseResponseTimeMs
      }
    })

    it('Should accept another request and update stats', async function () {
      await wait(1500)

      await servers[0].abuses.addMessage({ abuseId: abuse2, message: 'my message' })

      const lastTimestamp = new Date().getTime()

      {
        const data = await servers[0].stats.get()

        expect(data.totalAbuses).to.equal(3)
        expect(data.totalAbusesProcessed).to.equal(2)

        expect(data.averageAbuseResponseTimeMs).to.be.greaterThan(lastResponseTime)
        expect(data.averageAbuseResponseTimeMs).to.be.below(lastTimestamp - beforeTimestamp)
      }
    })
  })

  describe('Disabling stats', async function () {

    it('Should disable registration requests and abuses stats', async function () {
      this.timeout(60000)

      await servers[0].kill()
      await servers[0].run({
        stats: {
          registration_requests: { enabled: false },
          abuses: { enabled: false },
          total_admins: { enabled: false },
          total_moderators: { enabled: false }
        }
      })

      const data = await servers[0].stats.get()

      expect(data.totalRegistrationRequests).to.be.null
      expect(data.totalRegistrationRequestsProcessed).to.be.null
      expect(data.averageRegistrationRequestResponseTimeMs).to.be.null

      expect(data.totalAbuses).to.be.null
      expect(data.totalAbusesProcessed).to.be.null
      expect(data.averageAbuseResponseTimeMs).to.be.null

      expect(data.totalAdmins).to.be.null
      expect(data.totalModerators).to.be.null
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
