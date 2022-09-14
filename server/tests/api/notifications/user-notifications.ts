/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  CheckerBaseParams,
  checkMyVideoImportIsFinished,
  checkNewActorFollow,
  checkNewVideoFromSubscription,
  checkVideoIsPublished,
  checkVideoStudioEditionIsFinished,
  FIXTURE_URLS,
  MockSmtpServer,
  prepareNotificationsTest,
  uploadRandomVideoOnServers
} from '@server/tests/shared'
import { wait } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import { UserNotification, UserNotificationType, VideoPrivacy, VideoStudioTask } from '@shared/models'
import { cleanupTests, findExternalSavedVideo, PeerTubeServer, stopFfmpeg, waitJobs } from '@shared/server-commands'

describe('Test user notifications', function () {
  let servers: PeerTubeServer[] = []
  let userAccessToken: string

  let userNotifications: UserNotification[] = []
  let adminNotifications: UserNotification[] = []
  let adminNotificationsServer2: UserNotification[] = []
  let emails: object[] = []

  let channelId: number

  before(async function () {
    this.timeout(120000)

    const res = await prepareNotificationsTest(3)
    emails = res.emails
    userAccessToken = res.userAccessToken
    servers = res.servers
    userNotifications = res.userNotifications
    adminNotifications = res.adminNotifications
    adminNotificationsServer2 = res.adminNotificationsServer2
    channelId = res.channelId
  })

  describe('New video from my subscription notification', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }
    })

    it('Should not send notifications if the user does not follow the video publisher', async function () {
      this.timeout(50000)

      await uploadRandomVideoOnServers(servers, 1)

      const notification = await servers[0].notifications.getLatest({ token: userAccessToken })
      expect(notification).to.be.undefined

      expect(emails).to.have.lengthOf(0)
      expect(userNotifications).to.have.lengthOf(0)
    })

    it('Should send a new video notification if the user follows the local video publisher', async function () {
      this.timeout(15000)

      await servers[0].subscriptions.add({ token: userAccessToken, targetUri: 'root_channel@localhost:' + servers[0].port })
      await waitJobs(servers)

      const { name, shortUUID } = await uploadRandomVideoOnServers(servers, 1)
      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })

    it('Should send a new video notification from a remote account', async function () {
      this.timeout(150000) // Server 2 has transcoding enabled

      await servers[0].subscriptions.add({ token: userAccessToken, targetUri: 'root_channel@localhost:' + servers[1].port })
      await waitJobs(servers)

      const { name, shortUUID } = await uploadRandomVideoOnServers(servers, 2)
      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })

    it('Should send a new video notification on a scheduled publication', async function () {
      this.timeout(50000)

      // In 2 seconds
      const updateAt = new Date(new Date().getTime() + 2000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC as VideoPrivacy.PUBLIC
        }
      }
      const { name, shortUUID } = await uploadRandomVideoOnServers(servers, 1, data)

      await wait(6000)
      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })

    it('Should send a new video notification on a remote scheduled publication', async function () {
      this.timeout(100000)

      // In 2 seconds
      const updateAt = new Date(new Date().getTime() + 2000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC as VideoPrivacy.PUBLIC
        }
      }
      const { name, shortUUID } = await uploadRandomVideoOnServers(servers, 2, data)
      await waitJobs(servers)

      await wait(6000)
      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })

    it('Should not send a notification before the video is published', async function () {
      this.timeout(150000)

      const updateAt = new Date(new Date().getTime() + 1000000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC as VideoPrivacy.PUBLIC
        }
      }
      const { name, shortUUID } = await uploadRandomVideoOnServers(servers, 1, data)

      await wait(6000)
      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'absence' })
    })

    it('Should send a new video notification when a video becomes public', async function () {
      this.timeout(50000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid, shortUUID } = await uploadRandomVideoOnServers(servers, 1, data)

      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'absence' })

      await servers[0].videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })

      await waitJobs(servers)
      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })

    it('Should send a new video notification when a remote video becomes public', async function () {
      this.timeout(120000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid, shortUUID } = await uploadRandomVideoOnServers(servers, 2, data)

      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'absence' })

      await servers[1].videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })

      await waitJobs(servers)
      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })

    it('Should not send a new video notification when a video becomes unlisted', async function () {
      this.timeout(50000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid, shortUUID } = await uploadRandomVideoOnServers(servers, 1, data)

      await servers[0].videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.UNLISTED } })

      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'absence' })
    })

    it('Should not send a new video notification when a remote video becomes unlisted', async function () {
      this.timeout(100000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid, shortUUID } = await uploadRandomVideoOnServers(servers, 2, data)

      await servers[1].videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.UNLISTED } })

      await waitJobs(servers)
      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID, checkType: 'absence' })
    })

    it('Should send a new video notification after a video import', async function () {
      this.timeout(100000)

      const name = 'video import ' + buildUUID()

      const attributes = {
        name,
        channelId,
        privacy: VideoPrivacy.PUBLIC,
        targetUrl: FIXTURE_URLS.goodVideo
      }
      const { video } = await servers[0].imports.importVideo({ attributes })

      await waitJobs(servers)

      await checkNewVideoFromSubscription({ ...baseParams, videoName: name, shortUUID: video.shortUUID, checkType: 'presence' })
    })
  })

  describe('My video is published', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[1],
        emails,
        socketNotifications: adminNotificationsServer2,
        token: servers[1].accessToken
      }
    })

    it('Should not send a notification if transcoding is not enabled', async function () {
      this.timeout(50000)

      const { name, shortUUID } = await uploadRandomVideoOnServers(servers, 1)
      await waitJobs(servers)

      await checkVideoIsPublished({ ...baseParams, videoName: name, shortUUID, checkType: 'absence' })
    })

    it('Should not send a notification if the wait transcoding is false', async function () {
      this.timeout(100_000)

      await uploadRandomVideoOnServers(servers, 2, { waitTranscoding: false })
      await waitJobs(servers)

      const notification = await servers[0].notifications.getLatest({ token: userAccessToken })
      if (notification) {
        expect(notification.type).to.not.equal(UserNotificationType.MY_VIDEO_PUBLISHED)
      }
    })

    it('Should send a notification even if the video is not transcoded in other resolutions', async function () {
      this.timeout(50000)

      const { name, shortUUID } = await uploadRandomVideoOnServers(servers, 2, { waitTranscoding: true, fixture: 'video_short_240p.mp4' })
      await waitJobs(servers)

      await checkVideoIsPublished({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })

    it('Should send a notification with a transcoded video', async function () {
      this.timeout(50000)

      const { name, shortUUID } = await uploadRandomVideoOnServers(servers, 2, { waitTranscoding: true })
      await waitJobs(servers)

      await checkVideoIsPublished({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })

    it('Should send a notification when an imported video is transcoded', async function () {
      this.timeout(120000)

      const name = 'video import ' + buildUUID()

      const attributes = {
        name,
        channelId,
        privacy: VideoPrivacy.PUBLIC,
        targetUrl: FIXTURE_URLS.goodVideo,
        waitTranscoding: true
      }
      const { video } = await servers[1].imports.importVideo({ attributes })

      await waitJobs(servers)
      await checkVideoIsPublished({ ...baseParams, videoName: name, shortUUID: video.shortUUID, checkType: 'presence' })
    })

    it('Should send a notification when the scheduled update has been proceeded', async function () {
      this.timeout(70000)

      // In 2 seconds
      const updateAt = new Date(new Date().getTime() + 2000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC as VideoPrivacy.PUBLIC
        }
      }
      const { name, shortUUID } = await uploadRandomVideoOnServers(servers, 2, data)

      await wait(6000)
      await checkVideoIsPublished({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })

    it('Should not send a notification before the video is published', async function () {
      this.timeout(150000)

      const updateAt = new Date(new Date().getTime() + 1000000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC as VideoPrivacy.PUBLIC
        }
      }
      const { name, shortUUID } = await uploadRandomVideoOnServers(servers, 2, data)

      await wait(6000)
      await checkVideoIsPublished({ ...baseParams, videoName: name, shortUUID, checkType: 'absence' })
    })
  })

  describe('My live replay is published', function () {

    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[1],
        emails,
        socketNotifications: adminNotificationsServer2,
        token: servers[1].accessToken
      }
    })

    it('Should send a notification is a live replay of a non permanent live is published', async function () {
      this.timeout(120000)

      const { shortUUID } = await servers[1].live.create({
        fields: {
          name: 'non permanent live',
          privacy: VideoPrivacy.PUBLIC,
          channelId: servers[1].store.channel.id,
          saveReplay: true,
          permanentLive: false
        }
      })

      const ffmpegCommand = await servers[1].live.sendRTMPStreamInVideo({ videoId: shortUUID })

      await waitJobs(servers)
      await servers[1].live.waitUntilPublished({ videoId: shortUUID })

      await stopFfmpeg(ffmpegCommand)
      await servers[1].live.waitUntilReplacedByReplay({ videoId: shortUUID })

      await waitJobs(servers)
      await checkVideoIsPublished({ ...baseParams, videoName: 'non permanent live', shortUUID, checkType: 'presence' })
    })

    it('Should send a notification is a live replay of a permanent live is published', async function () {
      this.timeout(120000)

      const { shortUUID } = await servers[1].live.create({
        fields: {
          name: 'permanent live',
          privacy: VideoPrivacy.PUBLIC,
          channelId: servers[1].store.channel.id,
          saveReplay: true,
          permanentLive: true
        }
      })

      const ffmpegCommand = await servers[1].live.sendRTMPStreamInVideo({ videoId: shortUUID })

      await waitJobs(servers)
      await servers[1].live.waitUntilPublished({ videoId: shortUUID })

      const liveDetails = await servers[1].videos.get({ id: shortUUID })

      await stopFfmpeg(ffmpegCommand)

      await servers[1].live.waitUntilWaiting({ videoId: shortUUID })
      await waitJobs(servers)

      const video = await findExternalSavedVideo(servers[1], liveDetails)
      expect(video).to.exist

      await checkVideoIsPublished({ ...baseParams, videoName: video.name, shortUUID: video.shortUUID, checkType: 'presence' })
    })
  })

  describe('Video studio', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[1],
        emails,
        socketNotifications: adminNotificationsServer2,
        token: servers[1].accessToken
      }
    })

    it('Should send a notification after studio edition', async function () {
      this.timeout(240000)

      const { name, shortUUID, id } = await uploadRandomVideoOnServers(servers, 2, { waitTranscoding: true })

      await waitJobs(servers)
      await checkVideoIsPublished({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })

      const tasks: VideoStudioTask[] = [
        {
          name: 'cut',
          options: {
            start: 0,
            end: 1
          }
        }
      ]
      await servers[1].videoStudio.createEditionTasks({ videoId: id, tasks })
      await waitJobs(servers)

      await checkVideoStudioEditionIsFinished({ ...baseParams, videoName: name, shortUUID, checkType: 'presence' })
    })
  })

  describe('My video is imported', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: adminNotifications,
        token: servers[0].accessToken
      }
    })

    it('Should send a notification when the video import failed', async function () {
      this.timeout(70000)

      const name = 'video import ' + buildUUID()

      const attributes = {
        name,
        channelId,
        privacy: VideoPrivacy.PRIVATE,
        targetUrl: FIXTURE_URLS.badVideo
      }
      const { video: { shortUUID } } = await servers[0].imports.importVideo({ attributes })

      await waitJobs(servers)

      const url = FIXTURE_URLS.badVideo
      await checkMyVideoImportIsFinished({ ...baseParams, videoName: name, shortUUID, url, success: false, checkType: 'presence' })
    })

    it('Should send a notification when the video import succeeded', async function () {
      this.timeout(70000)

      const name = 'video import ' + buildUUID()

      const attributes = {
        name,
        channelId,
        privacy: VideoPrivacy.PRIVATE,
        targetUrl: FIXTURE_URLS.goodVideo
      }
      const { video: { shortUUID } } = await servers[0].imports.importVideo({ attributes })

      await waitJobs(servers)

      const url = FIXTURE_URLS.goodVideo
      await checkMyVideoImportIsFinished({ ...baseParams, videoName: name, shortUUID, url, success: true, checkType: 'presence' })
    })
  })

  describe('New actor follow', function () {
    let baseParams: CheckerBaseParams
    const myChannelName = 'super channel name'
    const myUserName = 'super user name'

    before(async () => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }

      await servers[0].users.updateMe({ displayName: 'super root name' })

      await servers[0].users.updateMe({
        token: userAccessToken,
        displayName: myUserName
      })

      await servers[1].users.updateMe({ displayName: 'super root 2 name' })

      await servers[0].channels.update({
        token: userAccessToken,
        channelName: 'user_1_channel',
        attributes: { displayName: myChannelName }
      })
    })

    it('Should notify when a local channel is following one of our channel', async function () {
      this.timeout(50000)

      await servers[0].subscriptions.add({ targetUri: 'user_1_channel@localhost:' + servers[0].port })
      await waitJobs(servers)

      await checkNewActorFollow({
        ...baseParams,
        followType: 'channel',
        followerName: 'root',
        followerDisplayName: 'super root name',
        followingDisplayName: myChannelName,
        checkType: 'presence'
      })

      await servers[0].subscriptions.remove({ uri: 'user_1_channel@localhost:' + servers[0].port })
    })

    it('Should notify when a remote channel is following one of our channel', async function () {
      this.timeout(50000)

      await servers[1].subscriptions.add({ targetUri: 'user_1_channel@localhost:' + servers[0].port })
      await waitJobs(servers)

      await checkNewActorFollow({
        ...baseParams,
        followType: 'channel',
        followerName: 'root',
        followerDisplayName: 'super root 2 name',
        followingDisplayName: myChannelName,
        checkType: 'presence'
      })

      await servers[1].subscriptions.remove({ uri: 'user_1_channel@localhost:' + servers[0].port })
    })

    // PeerTube does not support account -> account follows
    // it('Should notify when a local account is following one of our channel', async function () {
    //   this.timeout(50000)
    //
    //   await addUserSubscription(servers[0].url, servers[0].accessToken, 'user_1@localhost:' + servers[0].port)
    //
    //   await waitJobs(servers)
    //
    //   await checkNewActorFollow(baseParams, 'account', 'root', 'super root name', myUserName, 'presence')
    // })

    // it('Should notify when a remote account is following one of our channel', async function () {
    //   this.timeout(50000)
    //
    //   await addUserSubscription(servers[1].url, servers[1].accessToken, 'user_1@localhost:' + servers[0].port)
    //
    //   await waitJobs(servers)
    //
    //   await checkNewActorFollow(baseParams, 'account', 'root', 'super root 2 name', myUserName, 'presence')
    // })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests(servers)
  })
})
