/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  addVideoToBlacklist,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  flushTests,
  getMyUserInformation,
  immutableAssign,
  removeVideoFromBlacklist,
  reportVideoAbuse,
  updateVideo,
  userLogin,
  wait
} from '../../../../shared/utils'
import { killallServers, ServerInfo, uploadVideo } from '../../../../shared/utils/index'
import { setAccessTokensToServers } from '../../../../shared/utils/users/login'
import { waitJobs } from '../../../../shared/utils/server/jobs'
import { getUserNotificationSocket } from '../../../../shared/utils/socket/socket-io'
import {
  CheckerBaseParams,
  checkNewBlacklistOnMyVideo,
  checkNewCommentOnMyVideo,
  checkNewVideoAbuseForModerators,
  checkNewVideoFromSubscription,
  getLastNotification,
  getUserNotifications,
  markAsReadNotifications,
  updateMyNotificationSettings
} from '../../../../shared/utils/users/user-notifications'
import { User, UserNotification, UserNotificationSettingValue } from '../../../../shared/models/users'
import { MockSmtpServer } from '../../../../shared/utils/miscs/email'
import { addUserSubscription } from '../../../../shared/utils/users/user-subscriptions'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { getYoutubeVideoUrl, importVideo } from '../../../../shared/utils/videos/video-imports'
import { addVideoCommentReply, addVideoCommentThread } from '../../../../shared/utils/videos/video-comments'

const expect = chai.expect

async function uploadVideoByRemoteAccount (servers: ServerInfo[], videoNameId: number, additionalParams: any = {}) {
  const data = Object.assign({ name: 'remote video ' + videoNameId }, additionalParams)
  const res = await uploadVideo(servers[ 1 ].url, servers[ 1 ].accessToken, data)

  await waitJobs(servers)

  return res.body.video.uuid
}

async function uploadVideoByLocalAccount (servers: ServerInfo[], videoNameId: number, additionalParams: any = {}) {
  const data = Object.assign({ name: 'local video ' + videoNameId }, additionalParams)
  const res = await uploadVideo(servers[ 0 ].url, servers[ 0 ].accessToken, data)

  await waitJobs(servers)

  return res.body.video.uuid
}

describe('Test users notifications', function () {
  let servers: ServerInfo[] = []
  let userAccessToken: string
  let userNotifications: UserNotification[] = []
  let adminNotifications: UserNotification[] = []
  const emails: object[] = []

  before(async function () {
    this.timeout(120000)

    await MockSmtpServer.Instance.collectEmails(emails)

    await flushTests()

    const overrideConfig = {
      smtp: {
        hostname: 'localhost'
      }
    }
    servers = await flushAndRunMultipleServers(2, overrideConfig)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    await waitJobs(servers)

    const user = {
      username: 'user_1',
      password: 'super password'
    }
    await createUser(servers[0].url, servers[0].accessToken, user.username, user.password, 10 * 1000 * 1000)
    userAccessToken = await userLogin(servers[0], user)

    await updateMyNotificationSettings(servers[0].url, userAccessToken, {
      newCommentOnMyVideo: UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL,
      newVideoFromSubscription: UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL,
      blacklistOnMyVideo: UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL,
      videoAbuseAsModerator: UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL
    })

    {
      const socket = getUserNotificationSocket(servers[ 0 ].url, userAccessToken)
      socket.on('new-notification', n => userNotifications.push(n))
    }
    {
      const socket = getUserNotificationSocket(servers[ 0 ].url, servers[0].accessToken)
      socket.on('new-notification', n => adminNotifications.push(n))
    }
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
      await uploadVideoByLocalAccount(servers, 1)

      const notification = await getLastNotification(servers[ 0 ].url, userAccessToken)
      expect(notification).to.be.undefined

      expect(emails).to.have.lengthOf(0)
      expect(userNotifications).to.have.lengthOf(0)
    })

    it('Should send a new video notification if the user follows the local video publisher', async function () {
      await addUserSubscription(servers[0].url, userAccessToken, 'root_channel@localhost:9001')

      const videoNameId = 10
      const videoName = 'local video ' + videoNameId

      const uuid = await uploadVideoByLocalAccount(servers, videoNameId)
      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'presence')
    })

    it('Should send a new video notification from a remote account', async function () {
      this.timeout(50000) // Server 2 has transcoding enabled

      await addUserSubscription(servers[0].url, userAccessToken, 'root_channel@localhost:9002')

      const videoNameId = 20
      const videoName = 'remote video ' + videoNameId

      const uuid = await uploadVideoByRemoteAccount(servers, videoNameId)
      await waitJobs(servers)

      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'presence')
    })

    it('Should send a new video notification on a scheduled publication', async function () {
      this.timeout(20000)

      const videoNameId = 30
      const videoName = 'local video ' + videoNameId

      // In 2 seconds
      let updateAt = new Date(new Date().getTime() + 2000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }
      const uuid = await uploadVideoByLocalAccount(servers, videoNameId, data)

      await wait(6000)
      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'presence')
    })

    it('Should send a new video notification on a remote scheduled publication', async function () {
      this.timeout(20000)

      const videoNameId = 40
      const videoName = 'remote video ' + videoNameId

      // In 2 seconds
      let updateAt = new Date(new Date().getTime() + 2000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }
      const uuid = await uploadVideoByRemoteAccount(servers, videoNameId, data)
      await waitJobs(servers)

      await wait(6000)
      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'presence')
    })

    it('Should not send a notification before the video is published', async function () {
      this.timeout(20000)

      const videoNameId = 50
      const videoName = 'local video ' + videoNameId

      let updateAt = new Date(new Date().getTime() + 100000)

      const data = {
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }
      const uuid = await uploadVideoByLocalAccount(servers, videoNameId, data)

      await wait(6000)
      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'absence')
    })

    it('Should send a new video notification when a video becomes public', async function () {
      this.timeout(10000)

      const videoNameId = 60
      const videoName = 'local video ' + videoNameId

      const data = { privacy: VideoPrivacy.PRIVATE }
      const uuid = await uploadVideoByLocalAccount(servers, videoNameId, data)

      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'absence')

      await updateVideo(servers[0].url, servers[0].accessToken, uuid, { privacy: VideoPrivacy.PUBLIC })

      await wait(500)
      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'presence')
    })

    it('Should send a new video notification when a remote video becomes public', async function () {
      this.timeout(20000)

      const videoNameId = 70
      const videoName = 'remote video ' + videoNameId

      const data = { privacy: VideoPrivacy.PRIVATE }
      const uuid = await uploadVideoByRemoteAccount(servers, videoNameId, data)
      await waitJobs(servers)

      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'absence')

      await updateVideo(servers[1].url, servers[1].accessToken, uuid, { privacy: VideoPrivacy.PUBLIC })

      await waitJobs(servers)
      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'presence')
    })

    it('Should not send a new video notification when a video becomes unlisted', async function () {
      this.timeout(20000)

      const videoNameId = 80
      const videoName = 'local video ' + videoNameId

      const data = { privacy: VideoPrivacy.PRIVATE }
      const uuid = await uploadVideoByLocalAccount(servers, videoNameId, data)

      await updateVideo(servers[0].url, servers[0].accessToken, uuid, { privacy: VideoPrivacy.UNLISTED })

      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'absence')
    })

    it('Should not send a new video notification when a remote video becomes unlisted', async function () {
      this.timeout(20000)

      const videoNameId = 90
      const videoName = 'remote video ' + videoNameId

      const data = { privacy: VideoPrivacy.PRIVATE }
      const uuid = await uploadVideoByRemoteAccount(servers, videoNameId, data)
      await waitJobs(servers)

      await updateVideo(servers[1].url, servers[1].accessToken, uuid, { privacy: VideoPrivacy.UNLISTED })

      await waitJobs(servers)
      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'absence')
    })

    it('Should send a new video notification after a video import', async function () {
      this.timeout(30000)

      const resChannel = await getMyUserInformation(servers[0].url, servers[0].accessToken)
      const channelId = resChannel.body.videoChannels[0].id
      const videoName = 'local video 100'

      const attributes = {
        name: videoName,
        channelId,
        privacy: VideoPrivacy.PUBLIC,
        targetUrl: getYoutubeVideoUrl()
      }
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      const uuid = res.body.video.uuid

      await waitJobs(servers)

      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'presence')
    })
  })

  describe('Comment on my video notifications', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }
    })

    it('Should not send a new comment notification after a comment on another video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, 'comment')
      const commentId = resComment.body.comment.id

      await wait(500)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, commentId, 'absence')
    })

    it('Should not send a new comment notification if I comment my own video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, userAccessToken, uuid, 'comment')
      const commentId = resComment.body.comment.id

      await wait(500)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, commentId, 'absence')
    })

    it('Should send a new comment notification after a local comment on my video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, 'comment')
      const commentId = resComment.body.comment.id

      await wait(500)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, commentId, 'presence')
    })

    it('Should send a new comment notification after a remote comment on my video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      await waitJobs(servers)

      const resComment = await addVideoCommentThread(servers[1].url, servers[1].accessToken, uuid, 'comment')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, commentId, 'presence')
    })

    it('Should send a new comment notification after a local reply on my video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resThread = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, 'comment')
      const threadId = resThread.body.comment.id

      const resComment = await addVideoCommentReply(servers[0].url, servers[0].accessToken, uuid, threadId, 'reply')
      const commentId = resComment.body.comment.id

      await wait(500)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, threadId, 'presence')
    })

    it('Should send a new comment notification after a remote reply on my video', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid
      await waitJobs(servers)

      const resThread = await addVideoCommentThread(servers[1].url, servers[1].accessToken, uuid, 'comment')
      const threadId = resThread.body.comment.id

      const resComment = await addVideoCommentReply(servers[1].url, servers[1].accessToken, uuid, threadId, 'reply')
      const commentId = resComment.body.comment.id

      await waitJobs(servers)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, threadId, 'presence')
    })
  })

  describe('Video abuse for moderators notification' , function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: adminNotifications,
        token: servers[0].accessToken
      }
    })

    it('Should send a notification to moderators on local video abuse', async function () {
      this.timeout(10000)

      const videoName = 'local video 110'

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: videoName })
      const uuid = resVideo.body.video.uuid

      await reportVideoAbuse(servers[0].url, servers[0].accessToken, uuid, 'super reason')

      await waitJobs(servers)
      await checkNewVideoAbuseForModerators(baseParams, uuid, videoName, 'presence')
    })

    it('Should send a notification to moderators on remote video abuse', async function () {
      this.timeout(10000)

      const videoName = 'remote video 120'

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: videoName })
      const uuid = resVideo.body.video.uuid

      await waitJobs(servers)

      await reportVideoAbuse(servers[1].url, servers[1].accessToken, uuid, 'super reason')

      await waitJobs(servers)
      await checkNewVideoAbuseForModerators(baseParams, uuid, videoName, 'presence')
    })
  })

  describe('Video blacklist on my video', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }
    })

    it('Should send a notification to video owner on blacklist', async function () {
      this.timeout(10000)

      const videoName = 'local video 130'

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: videoName })
      const uuid = resVideo.body.video.uuid

      await addVideoToBlacklist(servers[0].url, servers[0].accessToken, uuid)

      await waitJobs(servers)
      await checkNewBlacklistOnMyVideo(baseParams, uuid, videoName, 'blacklist')
    })

    it('Should send a notification to video owner on unblacklist', async function () {
      this.timeout(10000)

      const videoName = 'local video 130'

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: videoName })
      const uuid = resVideo.body.video.uuid

      await addVideoToBlacklist(servers[0].url, servers[0].accessToken, uuid)

      await waitJobs(servers)
      await removeVideoFromBlacklist(servers[0].url, servers[0].accessToken, uuid)
      await waitJobs(servers)

      await wait(500)
      await checkNewBlacklistOnMyVideo(baseParams, uuid, videoName, 'unblacklist')
    })
  })

  describe('Mark as read', function () {
    it('Should mark as read some notifications', async function () {
      const res = await getUserNotifications(servers[0].url, userAccessToken, 2, 3)
      const ids = res.body.data.map(n => n.id)

      await markAsReadNotifications(servers[0].url, userAccessToken, ids)
    })

    it('Should have the notifications marked as read', async function () {
      const res = await getUserNotifications(servers[0].url, userAccessToken, 0, 10)

      const notifications = res.body.data as UserNotification[]
      expect(notifications[0].read).to.be.false
      expect(notifications[1].read).to.be.false
      expect(notifications[2].read).to.be.true
      expect(notifications[3].read).to.be.true
      expect(notifications[4].read).to.be.true
      expect(notifications[5].read).to.be.false
    })
  })

  describe('Notification settings', function () {
    const baseUpdateNotificationParams = {
      newCommentOnMyVideo: UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL,
      newVideoFromSubscription: UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL,
      videoAbuseAsModerator: UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL,
      blacklistOnMyVideo: UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL
    }
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }
    })

    it('Should not have notifications', async function () {
      await updateMyNotificationSettings(servers[0].url, userAccessToken, immutableAssign(baseUpdateNotificationParams, {
        newVideoFromSubscription: UserNotificationSettingValue.NONE
      }))

      {
        const res = await getMyUserInformation(servers[0].url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.NONE)
      }

      const videoNameId = 42
      const videoName = 'local video ' + videoNameId
      const uuid = await uploadVideoByLocalAccount(servers, videoNameId)

      const check = { web: true, mail: true }
      await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), videoName, uuid, 'absence')
    })

    it('Should only have web notifications', async function () {
      await updateMyNotificationSettings(servers[0].url, userAccessToken, immutableAssign(baseUpdateNotificationParams, {
        newVideoFromSubscription: UserNotificationSettingValue.WEB_NOTIFICATION
      }))

      {
        const res = await getMyUserInformation(servers[0].url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.WEB_NOTIFICATION)
      }

      const videoNameId = 52
      const videoName = 'local video ' + videoNameId
      const uuid = await uploadVideoByLocalAccount(servers, videoNameId)

      {
        const check = { mail: true, web: false }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), videoName, uuid, 'absence')
      }

      {
        const check = { mail: false, web: true }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), videoName, uuid, 'presence')
      }
    })

    it('Should only have mail notifications', async function () {
      await updateMyNotificationSettings(servers[0].url, userAccessToken, immutableAssign(baseUpdateNotificationParams, {
        newVideoFromSubscription: UserNotificationSettingValue.EMAIL
      }))

      {
        const res = await getMyUserInformation(servers[0].url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.EMAIL)
      }

      const videoNameId = 62
      const videoName = 'local video ' + videoNameId
      const uuid = await uploadVideoByLocalAccount(servers, videoNameId)

      {
        const check = { mail: false, web: true }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), videoName, uuid, 'absence')
      }

      {
        const check = { mail: true, web: false }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), videoName, uuid, 'presence')
      }
    })

    it('Should have email and web notifications', async function () {
      await updateMyNotificationSettings(servers[0].url, userAccessToken, immutableAssign(baseUpdateNotificationParams, {
        newVideoFromSubscription: UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL
      }))

      {
        const res = await getMyUserInformation(servers[0].url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.WEB_NOTIFICATION_AND_EMAIL)
      }

      const videoNameId = 72
      const videoName = 'local video ' + videoNameId
      const uuid = await uploadVideoByLocalAccount(servers, videoNameId)

      await checkNewVideoFromSubscription(baseParams, videoName, uuid, 'presence')
    })
  })

  after(async function () {
    killallServers(servers)
  })
})
