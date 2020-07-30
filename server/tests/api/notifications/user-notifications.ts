/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { v4 as uuidv4 } from 'uuid'
import {
  cleanupTests,
  updateMyUser,
  updateVideo,
  updateVideoChannel,
  uploadRandomVideoOnServers,
  wait
} from '../../../../shared/extra-utils'
import { ServerInfo } from '../../../../shared/extra-utils/index'
import { MockSmtpServer } from '../../../../shared/extra-utils/miscs/email'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import {
  CheckerBaseParams,
  checkMyVideoImportIsFinished,
  checkNewActorFollow,
  checkNewVideoFromSubscription,
  checkVideoIsPublished,
  getLastNotification,
  prepareNotificationsTest
} from '../../../../shared/extra-utils/users/user-notifications'
import { addUserSubscription, removeUserSubscription } from '../../../../shared/extra-utils/users/user-subscriptions'
import { getBadVideoUrl, getGoodVideoUrl, importVideo } from '../../../../shared/extra-utils/videos/video-imports'
import { UserNotification, UserNotificationType } from '../../../../shared/models/users'
import { VideoPrivacy } from '../../../../shared/models/videos'

const expect = chai.expect

describe('Test user notifications', function () {
  let servers: ServerInfo[] = []
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
      this.timeout(10000)

      await uploadRandomVideoOnServers(servers, 1)

      const notification = await getLastNotification(servers[0].url, userAccessToken)
      expect(notification).to.be.undefined

      expect(emails).to.have.lengthOf(0)
      expect(userNotifications).to.have.lengthOf(0)
    })

    it('Should send a new video notification if the user follows the local video publisher', async function () {
      this.timeout(15000)

      await addUserSubscription(servers[0].url, userAccessToken, 'root_channel@localhost:' + servers[0].port)
      await waitJobs(servers)

      const { name, uuid } = await uploadRandomVideoOnServers(servers, 1)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })

    it('Should send a new video notification from a remote account', async function () {
      this.timeout(50000) // Server 2 has transcoding enabled

      await addUserSubscription(servers[0].url, userAccessToken, 'root_channel@localhost:' + servers[1].port)
      await waitJobs(servers)

      const { name, uuid } = await uploadRandomVideoOnServers(servers, 2)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })

    it('Should send a new video notification on a scheduled publication', async function () {
      this.timeout(20000)

      // In 2 seconds
      const updateAt = new Date(new Date().getTime() + 2000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }
      const { name, uuid } = await uploadRandomVideoOnServers(servers, 1, data)

      await wait(6000)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })

    it('Should send a new video notification on a remote scheduled publication', async function () {
      this.timeout(50000)

      // In 2 seconds
      const updateAt = new Date(new Date().getTime() + 2000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }
      const { name, uuid } = await uploadRandomVideoOnServers(servers, 2, data)
      await waitJobs(servers)

      await wait(6000)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })

    it('Should not send a notification before the video is published', async function () {
      this.timeout(20000)

      const updateAt = new Date(new Date().getTime() + 1000000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }
      const { name, uuid } = await uploadRandomVideoOnServers(servers, 1, data)

      await wait(6000)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'absence')
    })

    it('Should send a new video notification when a video becomes public', async function () {
      this.timeout(10000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid } = await uploadRandomVideoOnServers(servers, 1, data)

      await checkNewVideoFromSubscription(baseParams, name, uuid, 'absence')

      await updateVideo(servers[0].url, servers[0].accessToken, uuid, { privacy: VideoPrivacy.PUBLIC })

      await wait(500)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })

    it('Should send a new video notification when a remote video becomes public', async function () {
      this.timeout(20000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid } = await uploadRandomVideoOnServers(servers, 2, data)

      await checkNewVideoFromSubscription(baseParams, name, uuid, 'absence')

      await updateVideo(servers[1].url, servers[1].accessToken, uuid, { privacy: VideoPrivacy.PUBLIC })

      await waitJobs(servers)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })

    it('Should not send a new video notification when a video becomes unlisted', async function () {
      this.timeout(20000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid } = await uploadRandomVideoOnServers(servers, 1, data)

      await updateVideo(servers[0].url, servers[0].accessToken, uuid, { privacy: VideoPrivacy.UNLISTED })

      await checkNewVideoFromSubscription(baseParams, name, uuid, 'absence')
    })

    it('Should not send a new video notification when a remote video becomes unlisted', async function () {
      this.timeout(20000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid } = await uploadRandomVideoOnServers(servers, 2, data)

      await updateVideo(servers[1].url, servers[1].accessToken, uuid, { privacy: VideoPrivacy.UNLISTED })

      await waitJobs(servers)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'absence')
    })

    it('Should send a new video notification after a video import', async function () {
      this.timeout(100000)

      const name = 'video import ' + uuidv4()

      const attributes = {
        name,
        channelId,
        privacy: VideoPrivacy.PUBLIC,
        targetUrl: getGoodVideoUrl()
      }
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      const uuid = res.body.video.uuid

      await waitJobs(servers)

      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
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
      this.timeout(10000)

      const { name, uuid } = await uploadRandomVideoOnServers(servers, 1)
      await waitJobs(servers)

      await checkVideoIsPublished(baseParams, name, uuid, 'absence')
    })

    it('Should not send a notification if the wait transcoding is false', async function () {
      this.timeout(50000)

      await uploadRandomVideoOnServers(servers, 2, { waitTranscoding: false })
      await waitJobs(servers)

      const notification = await getLastNotification(servers[0].url, userAccessToken)
      if (notification) {
        expect(notification.type).to.not.equal(UserNotificationType.MY_VIDEO_PUBLISHED)
      }
    })

    it('Should send a notification even if the video is not transcoded in other resolutions', async function () {
      this.timeout(50000)

      const { name, uuid } = await uploadRandomVideoOnServers(servers, 2, { waitTranscoding: true, fixture: 'video_short_240p.mp4' })
      await waitJobs(servers)

      await checkVideoIsPublished(baseParams, name, uuid, 'presence')
    })

    it('Should send a notification with a transcoded video', async function () {
      this.timeout(50000)

      const { name, uuid } = await uploadRandomVideoOnServers(servers, 2, { waitTranscoding: true })
      await waitJobs(servers)

      await checkVideoIsPublished(baseParams, name, uuid, 'presence')
    })

    it('Should send a notification when an imported video is transcoded', async function () {
      this.timeout(50000)

      const name = 'video import ' + uuidv4()

      const attributes = {
        name,
        channelId,
        privacy: VideoPrivacy.PUBLIC,
        targetUrl: getGoodVideoUrl(),
        waitTranscoding: true
      }
      const res = await importVideo(servers[1].url, servers[1].accessToken, attributes)
      const uuid = res.body.video.uuid

      await waitJobs(servers)
      await checkVideoIsPublished(baseParams, name, uuid, 'presence')
    })

    it('Should send a notification when the scheduled update has been proceeded', async function () {
      this.timeout(70000)

      // In 2 seconds
      const updateAt = new Date(new Date().getTime() + 2000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }
      const { name, uuid } = await uploadRandomVideoOnServers(servers, 2, data)

      await wait(6000)
      await checkVideoIsPublished(baseParams, name, uuid, 'presence')
    })

    it('Should not send a notification before the video is published', async function () {
      this.timeout(40000)

      const updateAt = new Date(new Date().getTime() + 1000000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }
      const { name, uuid } = await uploadRandomVideoOnServers(servers, 2, data)

      await wait(6000)
      await checkVideoIsPublished(baseParams, name, uuid, 'absence')
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

      const name = 'video import ' + uuidv4()

      const attributes = {
        name,
        channelId,
        privacy: VideoPrivacy.PRIVATE,
        targetUrl: getBadVideoUrl()
      }
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      const uuid = res.body.video.uuid

      await waitJobs(servers)
      await checkMyVideoImportIsFinished(baseParams, name, uuid, getBadVideoUrl(), false, 'presence')
    })

    it('Should send a notification when the video import succeeded', async function () {
      this.timeout(70000)

      const name = 'video import ' + uuidv4()

      const attributes = {
        name,
        channelId,
        privacy: VideoPrivacy.PRIVATE,
        targetUrl: getGoodVideoUrl()
      }
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      const uuid = res.body.video.uuid

      await waitJobs(servers)
      await checkMyVideoImportIsFinished(baseParams, name, uuid, getGoodVideoUrl(), true, 'presence')
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

      await updateMyUser({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        displayName: 'super root name'
      })

      await updateMyUser({
        url: servers[0].url,
        accessToken: userAccessToken,
        displayName: myUserName
      })

      await updateMyUser({
        url: servers[1].url,
        accessToken: servers[1].accessToken,
        displayName: 'super root 2 name'
      })

      await updateVideoChannel(servers[0].url, userAccessToken, 'user_1_channel', { displayName: myChannelName })
    })

    it('Should notify when a local channel is following one of our channel', async function () {
      this.timeout(10000)

      await addUserSubscription(servers[0].url, servers[0].accessToken, 'user_1_channel@localhost:' + servers[0].port)
      await waitJobs(servers)

      await checkNewActorFollow(baseParams, 'channel', 'root', 'super root name', myChannelName, 'presence')

      await removeUserSubscription(servers[0].url, servers[0].accessToken, 'user_1_channel@localhost:' + servers[0].port)
    })

    it('Should notify when a remote channel is following one of our channel', async function () {
      this.timeout(10000)

      await addUserSubscription(servers[1].url, servers[1].accessToken, 'user_1_channel@localhost:' + servers[0].port)
      await waitJobs(servers)

      await checkNewActorFollow(baseParams, 'channel', 'root', 'super root 2 name', myChannelName, 'presence')

      await removeUserSubscription(servers[1].url, servers[1].accessToken, 'user_1_channel@localhost:' + servers[0].port)
    })

    // PeerTube does not support accout -> account follows
    // it('Should notify when a local account is following one of our channel', async function () {
    //   this.timeout(10000)
    //
    //   await addUserSubscription(servers[0].url, servers[0].accessToken, 'user_1@localhost:' + servers[0].port)
    //
    //   await waitJobs(servers)
    //
    //   await checkNewActorFollow(baseParams, 'account', 'root', 'super root name', myUserName, 'presence')
    // })

    // it('Should notify when a remote account is following one of our channel', async function () {
    //   this.timeout(10000)
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
