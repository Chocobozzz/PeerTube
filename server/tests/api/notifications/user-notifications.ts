/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import {
  addVideoToBlacklist,
  cleanupTests,
  createUser,
  doubleFollow,
  flushAndRunMultipleServers,
  follow,
  getCustomConfig,
  getMyUserInformation,
  getVideoCommentThreads,
  getVideoThreadComments,
  immutableAssign,
  MockInstancesIndex,
  registerUser,
  removeVideoFromBlacklist,
  reportVideoAbuse,
  unfollow,
  updateCustomConfig,
  updateCustomSubConfig,
  updateMyUser,
  updateVideo,
  updateVideoChannel,
  userLogin,
  wait
} from '../../../../shared/extra-utils'
import { ServerInfo, uploadVideo } from '../../../../shared/extra-utils/index'
import { setAccessTokensToServers } from '../../../../shared/extra-utils/users/login'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import { getUserNotificationSocket } from '../../../../shared/extra-utils/socket/socket-io'
import {
  checkAutoInstanceFollowing,
  checkCommentMention,
  CheckerBaseParams,
  checkMyVideoImportIsFinished,
  checkNewActorFollow,
  checkNewBlacklistOnMyVideo,
  checkNewCommentOnMyVideo,
  checkNewInstanceFollower,
  checkNewVideoAbuseForModerators,
  checkNewVideoFromSubscription,
  checkUserRegistered,
  checkVideoAutoBlacklistForModerators,
  checkVideoIsPublished,
  getLastNotification,
  getUserNotifications,
  markAsReadAllNotifications,
  markAsReadNotifications,
  updateMyNotificationSettings
} from '../../../../shared/extra-utils/users/user-notifications'
import {
  User,
  UserNotification,
  UserNotificationSetting,
  UserNotificationSettingValue,
  UserNotificationType
} from '../../../../shared/models/users'
import { MockSmtpServer } from '../../../../shared/extra-utils/miscs/email'
import { addUserSubscription, removeUserSubscription } from '../../../../shared/extra-utils/users/user-subscriptions'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { getBadVideoUrl, getYoutubeVideoUrl, importVideo } from '../../../../shared/extra-utils/videos/video-imports'
import { addVideoCommentReply, addVideoCommentThread } from '../../../../shared/extra-utils/videos/video-comments'
import { v4 as uuidv4 } from 'uuid'
import { addAccountToAccountBlocklist, removeAccountFromAccountBlocklist } from '../../../../shared/extra-utils/users/blocklist'
import { CustomConfig } from '../../../../shared/models/server'
import { VideoCommentThreadTree } from '../../../../shared/models/videos/video-comment.model'

const expect = chai.expect

async function uploadVideoByRemoteAccount (servers: ServerInfo[], additionalParams: any = {}) {
  const name = 'remote video ' + uuidv4()

  const data = Object.assign({ name }, additionalParams)
  const res = await uploadVideo(servers[1].url, servers[1].accessToken, data)

  await waitJobs(servers)

  return { uuid: res.body.video.uuid, name }
}

async function uploadVideoByLocalAccount (servers: ServerInfo[], additionalParams: any = {}) {
  const name = 'local video ' + uuidv4()

  const data = Object.assign({ name }, additionalParams)
  const res = await uploadVideo(servers[0].url, servers[0].accessToken, data)

  await waitJobs(servers)

  return { uuid: res.body.video.uuid, name }
}

describe('Test users notifications', function () {
  let servers: ServerInfo[] = []
  let userAccessToken: string
  const userNotifications: UserNotification[] = []
  const adminNotifications: UserNotification[] = []
  const adminNotificationsServer2: UserNotification[] = []
  const emails: object[] = []
  let channelId: number

  const allNotificationSettings: UserNotificationSetting = {
    newVideoFromSubscription: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newCommentOnMyVideo: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    videoAbuseAsModerator: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    videoAutoBlacklistAsModerator: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    blacklistOnMyVideo: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    myVideoImportFinished: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    myVideoPublished: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    commentMention: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newFollow: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newUserRegistration: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    newInstanceFollower: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL,
    autoInstanceFollowing: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
  }

  before(async function () {
    this.timeout(120000)

    const port = await MockSmtpServer.Instance.collectEmails(emails)

    const overrideConfig = {
      smtp: {
        hostname: 'localhost',
        port
      }
    }
    servers = await flushAndRunMultipleServers(3, overrideConfig)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    await waitJobs(servers)

    const user = {
      username: 'user_1',
      password: 'super password'
    }
    await createUser({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      username: user.username,
      password: user.password,
      videoQuota: 10 * 1000 * 1000
    })
    userAccessToken = await userLogin(servers[0], user)

    await updateMyNotificationSettings(servers[0].url, userAccessToken, allNotificationSettings)
    await updateMyNotificationSettings(servers[0].url, servers[0].accessToken, allNotificationSettings)
    await updateMyNotificationSettings(servers[1].url, servers[1].accessToken, allNotificationSettings)

    {
      const socket = getUserNotificationSocket(servers[0].url, userAccessToken)
      socket.on('new-notification', n => userNotifications.push(n))
    }
    {
      const socket = getUserNotificationSocket(servers[0].url, servers[0].accessToken)
      socket.on('new-notification', n => adminNotifications.push(n))
    }
    {
      const socket = getUserNotificationSocket(servers[1].url, servers[1].accessToken)
      socket.on('new-notification', n => adminNotificationsServer2.push(n))
    }

    {
      const resChannel = await getMyUserInformation(servers[0].url, servers[0].accessToken)
      channelId = resChannel.body.videoChannels[0].id
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
      this.timeout(10000)

      await uploadVideoByLocalAccount(servers)

      const notification = await getLastNotification(servers[0].url, userAccessToken)
      expect(notification).to.be.undefined

      expect(emails).to.have.lengthOf(0)
      expect(userNotifications).to.have.lengthOf(0)
    })

    it('Should send a new video notification if the user follows the local video publisher', async function () {
      this.timeout(15000)

      await addUserSubscription(servers[0].url, userAccessToken, 'root_channel@localhost:' + servers[0].port)
      await waitJobs(servers)

      const { name, uuid } = await uploadVideoByLocalAccount(servers)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })

    it('Should send a new video notification from a remote account', async function () {
      this.timeout(50000) // Server 2 has transcoding enabled

      await addUserSubscription(servers[0].url, userAccessToken, 'root_channel@localhost:' + servers[1].port)
      await waitJobs(servers)

      const { name, uuid } = await uploadVideoByRemoteAccount(servers)
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
      const { name, uuid } = await uploadVideoByLocalAccount(servers, data)

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
      const { name, uuid } = await uploadVideoByRemoteAccount(servers, data)
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
      const { name, uuid } = await uploadVideoByLocalAccount(servers, data)

      await wait(6000)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'absence')
    })

    it('Should send a new video notification when a video becomes public', async function () {
      this.timeout(10000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid } = await uploadVideoByLocalAccount(servers, data)

      await checkNewVideoFromSubscription(baseParams, name, uuid, 'absence')

      await updateVideo(servers[0].url, servers[0].accessToken, uuid, { privacy: VideoPrivacy.PUBLIC })

      await wait(500)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })

    it('Should send a new video notification when a remote video becomes public', async function () {
      this.timeout(20000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid } = await uploadVideoByRemoteAccount(servers, data)

      await checkNewVideoFromSubscription(baseParams, name, uuid, 'absence')

      await updateVideo(servers[1].url, servers[1].accessToken, uuid, { privacy: VideoPrivacy.PUBLIC })

      await waitJobs(servers)
      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })

    it('Should not send a new video notification when a video becomes unlisted', async function () {
      this.timeout(20000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid } = await uploadVideoByLocalAccount(servers, data)

      await updateVideo(servers[0].url, servers[0].accessToken, uuid, { privacy: VideoPrivacy.UNLISTED })

      await checkNewVideoFromSubscription(baseParams, name, uuid, 'absence')
    })

    it('Should not send a new video notification when a remote video becomes unlisted', async function () {
      this.timeout(20000)

      const data = { privacy: VideoPrivacy.PRIVATE }
      const { name, uuid } = await uploadVideoByRemoteAccount(servers, data)

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
        targetUrl: getYoutubeVideoUrl()
      }
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      const uuid = res.body.video.uuid

      await waitJobs(servers)

      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
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

    it('Should not send a new comment notification if the account is muted', async function () {
      this.timeout(10000)

      await addAccountToAccountBlocklist(servers[0].url, userAccessToken, 'root')

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, 'comment')
      const commentId = resComment.body.comment.id

      await wait(500)
      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, commentId, 'absence')

      await removeAccountFromAccountBlocklist(servers[0].url, userAccessToken, 'root')
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

      await addVideoCommentThread(servers[1].url, servers[1].accessToken, uuid, 'comment')

      await waitJobs(servers)

      const resComment = await getVideoCommentThreads(servers[0].url, uuid, 0, 5)
      expect(resComment.body.data).to.have.lengthOf(1)
      const commentId = resComment.body.data[0].id

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

      {
        const resThread = await addVideoCommentThread(servers[1].url, servers[1].accessToken, uuid, 'comment')
        const threadId = resThread.body.comment.id
        await addVideoCommentReply(servers[1].url, servers[1].accessToken, uuid, threadId, 'reply')
      }

      await waitJobs(servers)

      const resThread = await getVideoCommentThreads(servers[0].url, uuid, 0, 5)
      expect(resThread.body.data).to.have.lengthOf(1)
      const threadId = resThread.body.data[0].id

      const resComments = await getVideoThreadComments(servers[0].url, uuid, threadId)
      const tree = resComments.body as VideoCommentThreadTree

      expect(tree.children).to.have.lengthOf(1)
      const commentId = tree.children[0].comment.id

      await checkNewCommentOnMyVideo(baseParams, uuid, commentId, threadId, 'presence')
    })
  })

  describe('Mention notifications', function () {
    let baseParams: CheckerBaseParams

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
        url: servers[1].url,
        accessToken: servers[1].accessToken,
        displayName: 'super root 2 name'
      })
    })

    it('Should not send a new mention comment notification if I mention the video owner', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, '@user_1 hello')
      const commentId = resComment.body.comment.id

      await wait(500)
      await checkCommentMention(baseParams, uuid, commentId, commentId, 'super root name', 'absence')
    })

    it('Should not send a new mention comment notification if I mention myself', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, userAccessToken, uuid, '@user_1 hello')
      const commentId = resComment.body.comment.id

      await wait(500)
      await checkCommentMention(baseParams, uuid, commentId, commentId, 'super root name', 'absence')
    })

    it('Should not send a new mention notification if the account is muted', async function () {
      this.timeout(10000)

      await addAccountToAccountBlocklist(servers[0].url, userAccessToken, 'root')

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resComment = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, '@user_1 hello')
      const commentId = resComment.body.comment.id

      await wait(500)
      await checkCommentMention(baseParams, uuid, commentId, commentId, 'super root name', 'absence')

      await removeAccountFromAccountBlocklist(servers[0].url, userAccessToken, 'root')
    })

    it('Should not send a new mention notification if the remote account mention a local account', async function () {
      this.timeout(20000)

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      await waitJobs(servers)
      const resThread = await addVideoCommentThread(servers[1].url, servers[1].accessToken, uuid, '@user_1 hello')
      const threadId = resThread.body.comment.id

      await waitJobs(servers)
      await checkCommentMention(baseParams, uuid, threadId, threadId, 'super root 2 name', 'absence')
    })

    it('Should send a new mention notification after local comments', async function () {
      this.timeout(10000)

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      const resThread = await addVideoCommentThread(servers[0].url, servers[0].accessToken, uuid, '@user_1 hello 1')
      const threadId = resThread.body.comment.id

      await wait(500)
      await checkCommentMention(baseParams, uuid, threadId, threadId, 'super root name', 'presence')

      const resComment = await addVideoCommentReply(servers[0].url, servers[0].accessToken, uuid, threadId, 'hello 2 @user_1')
      const commentId = resComment.body.comment.id

      await wait(500)
      await checkCommentMention(baseParams, uuid, commentId, threadId, 'super root name', 'presence')
    })

    it('Should send a new mention notification after remote comments', async function () {
      this.timeout(20000)

      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'super video' })
      const uuid = resVideo.body.video.uuid

      await waitJobs(servers)

      const text1 = `hello @user_1@localhost:${servers[0].port} 1`
      const resThread = await addVideoCommentThread(servers[1].url, servers[1].accessToken, uuid, text1)
      const server2ThreadId = resThread.body.comment.id

      await waitJobs(servers)

      const resThread2 = await getVideoCommentThreads(servers[0].url, uuid, 0, 5)
      expect(resThread2.body.data).to.have.lengthOf(1)
      const server1ThreadId = resThread2.body.data[0].id
      await checkCommentMention(baseParams, uuid, server1ThreadId, server1ThreadId, 'super root 2 name', 'presence')

      const text2 = `@user_1@localhost:${servers[0].port} hello 2 @root@localhost:${servers[0].port}`
      await addVideoCommentReply(servers[1].url, servers[1].accessToken, uuid, server2ThreadId, text2)

      await waitJobs(servers)

      const resComments = await getVideoThreadComments(servers[0].url, uuid, server1ThreadId)
      const tree = resComments.body as VideoCommentThreadTree

      expect(tree.children).to.have.lengthOf(1)
      const commentId = tree.children[0].comment.id

      await checkCommentMention(baseParams, uuid, commentId, server1ThreadId, 'super root 2 name', 'presence')
    })
  })

  describe('Video abuse for moderators notification', function () {
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

      const name = 'video for abuse ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name })
      const uuid = resVideo.body.video.uuid

      await reportVideoAbuse(servers[0].url, servers[0].accessToken, uuid, 'super reason')

      await waitJobs(servers)
      await checkNewVideoAbuseForModerators(baseParams, uuid, name, 'presence')
    })

    it('Should send a notification to moderators on remote video abuse', async function () {
      this.timeout(10000)

      const name = 'video for abuse ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name })
      const uuid = resVideo.body.video.uuid

      await waitJobs(servers)

      await reportVideoAbuse(servers[1].url, servers[1].accessToken, uuid, 'super reason')

      await waitJobs(servers)
      await checkNewVideoAbuseForModerators(baseParams, uuid, name, 'presence')
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

      const name = 'video for abuse ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name })
      const uuid = resVideo.body.video.uuid

      await addVideoToBlacklist(servers[0].url, servers[0].accessToken, uuid)

      await waitJobs(servers)
      await checkNewBlacklistOnMyVideo(baseParams, uuid, name, 'blacklist')
    })

    it('Should send a notification to video owner on unblacklist', async function () {
      this.timeout(10000)

      const name = 'video for abuse ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name })
      const uuid = resVideo.body.video.uuid

      await addVideoToBlacklist(servers[0].url, servers[0].accessToken, uuid)

      await waitJobs(servers)
      await removeVideoFromBlacklist(servers[0].url, servers[0].accessToken, uuid)
      await waitJobs(servers)

      await wait(500)
      await checkNewBlacklistOnMyVideo(baseParams, uuid, name, 'unblacklist')
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

      const { name, uuid } = await uploadVideoByLocalAccount(servers)
      await waitJobs(servers)

      await checkVideoIsPublished(baseParams, name, uuid, 'absence')
    })

    it('Should not send a notification if the wait transcoding is false', async function () {
      this.timeout(50000)

      await uploadVideoByRemoteAccount(servers, { waitTranscoding: false })
      await waitJobs(servers)

      const notification = await getLastNotification(servers[0].url, userAccessToken)
      if (notification) {
        expect(notification.type).to.not.equal(UserNotificationType.MY_VIDEO_PUBLISHED)
      }
    })

    it('Should send a notification even if the video is not transcoded in other resolutions', async function () {
      this.timeout(50000)

      const { name, uuid } = await uploadVideoByRemoteAccount(servers, { waitTranscoding: true, fixture: 'video_short_240p.mp4' })
      await waitJobs(servers)

      await checkVideoIsPublished(baseParams, name, uuid, 'presence')
    })

    it('Should send a notification with a transcoded video', async function () {
      this.timeout(50000)

      const { name, uuid } = await uploadVideoByRemoteAccount(servers, { waitTranscoding: true })
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
        targetUrl: getYoutubeVideoUrl(),
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
      const { name, uuid } = await uploadVideoByRemoteAccount(servers, data)

      await wait(6000)
      await checkVideoIsPublished(baseParams, name, uuid, 'presence')
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
      const { name, uuid } = await uploadVideoByRemoteAccount(servers, data)

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
        targetUrl: getYoutubeVideoUrl()
      }
      const res = await importVideo(servers[0].url, servers[0].accessToken, attributes)
      const uuid = res.body.video.uuid

      await waitJobs(servers)
      await checkMyVideoImportIsFinished(baseParams, name, uuid, getYoutubeVideoUrl(), true, 'presence')
    })
  })

  describe('New registration', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: adminNotifications,
        token: servers[0].accessToken
      }
    })

    it('Should send a notification only to moderators when a user registers on the instance', async function () {
      this.timeout(10000)

      await registerUser(servers[0].url, 'user_45', 'password')

      await waitJobs(servers)

      await checkUserRegistered(baseParams, 'user_45', 'presence')

      const userOverride = { socketNotifications: userNotifications, token: userAccessToken, check: { web: true, mail: false } }
      await checkUserRegistered(immutableAssign(baseParams, userOverride), 'user_45', 'absence')
    })
  })

  describe('New instance follows', function () {
    const instanceIndexServer = new MockInstancesIndex()
    const config = {
      followings: {
        instance: {
          autoFollowIndex: {
            indexUrl: 'http://localhost:42101/api/v1/instances/hosts',
            enabled: true
          }
        }
      }
    }
    let baseParams: CheckerBaseParams

    before(async () => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: adminNotifications,
        token: servers[0].accessToken
      }

      await instanceIndexServer.initialize()
      instanceIndexServer.addInstance(servers[1].host)
    })

    it('Should send a notification only to admin when there is a new instance follower', async function () {
      this.timeout(20000)

      await follow(servers[2].url, [ servers[0].url ], servers[2].accessToken)

      await waitJobs(servers)

      await checkNewInstanceFollower(baseParams, 'localhost:' + servers[2].port, 'presence')

      const userOverride = { socketNotifications: userNotifications, token: userAccessToken, check: { web: true, mail: false } }
      await checkNewInstanceFollower(immutableAssign(baseParams, userOverride), 'localhost:' + servers[2].port, 'absence')
    })

    it('Should send a notification on auto follow back', async function () {
      this.timeout(40000)

      await unfollow(servers[2].url, servers[2].accessToken, servers[0])
      await waitJobs(servers)

      const config = {
        followings: {
          instance: {
            autoFollowBack: { enabled: true }
          }
        }
      }
      await updateCustomSubConfig(servers[0].url, servers[0].accessToken, config)

      await follow(servers[2].url, [ servers[0].url ], servers[2].accessToken)

      await waitJobs(servers)

      const followerHost = servers[0].host
      const followingHost = servers[2].host
      await checkAutoInstanceFollowing(baseParams, followerHost, followingHost, 'presence')

      const userOverride = { socketNotifications: userNotifications, token: userAccessToken, check: { web: true, mail: false } }
      await checkAutoInstanceFollowing(immutableAssign(baseParams, userOverride), followerHost, followingHost, 'absence')

      config.followings.instance.autoFollowBack.enabled = false
      await updateCustomSubConfig(servers[0].url, servers[0].accessToken, config)
      await unfollow(servers[0].url, servers[0].accessToken, servers[2])
      await unfollow(servers[2].url, servers[2].accessToken, servers[0])
    })

    it('Should send a notification on auto instances index follow', async function () {
      this.timeout(30000)
      await unfollow(servers[0].url, servers[0].accessToken, servers[1])

      await updateCustomSubConfig(servers[0].url, servers[0].accessToken, config)

      await wait(5000)
      await waitJobs(servers)

      const followerHost = servers[0].host
      const followingHost = servers[1].host
      await checkAutoInstanceFollowing(baseParams, followerHost, followingHost, 'presence')

      config.followings.instance.autoFollowIndex.enabled = false
      await updateCustomSubConfig(servers[0].url, servers[0].accessToken, config)
      await unfollow(servers[0].url, servers[0].accessToken, servers[1])
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

  describe('Video-related notifications when video auto-blacklist is enabled', function () {
    let userBaseParams: CheckerBaseParams
    let adminBaseParamsServer1: CheckerBaseParams
    let adminBaseParamsServer2: CheckerBaseParams
    let videoUUID: string
    let videoName: string
    let currentCustomConfig: CustomConfig

    before(async () => {

      adminBaseParamsServer1 = {
        server: servers[0],
        emails,
        socketNotifications: adminNotifications,
        token: servers[0].accessToken
      }

      adminBaseParamsServer2 = {
        server: servers[1],
        emails,
        socketNotifications: adminNotificationsServer2,
        token: servers[1].accessToken
      }

      userBaseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }

      const resCustomConfig = await getCustomConfig(servers[0].url, servers[0].accessToken)
      currentCustomConfig = resCustomConfig.body
      const autoBlacklistTestsCustomConfig = immutableAssign(currentCustomConfig, {
        autoBlacklist: {
          videos: {
            ofUsers: {
              enabled: true
            }
          }
        }
      })
      // enable transcoding otherwise own publish notification after transcoding not expected
      autoBlacklistTestsCustomConfig.transcoding.enabled = true
      await updateCustomConfig(servers[0].url, servers[0].accessToken, autoBlacklistTestsCustomConfig)

      await addUserSubscription(servers[0].url, servers[0].accessToken, 'user_1_channel@localhost:' + servers[0].port)
      await addUserSubscription(servers[1].url, servers[1].accessToken, 'user_1_channel@localhost:' + servers[0].port)

    })

    it('Should send notification to moderators on new video with auto-blacklist', async function () {
      this.timeout(20000)

      videoName = 'video with auto-blacklist ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name: videoName })
      videoUUID = resVideo.body.video.uuid

      await waitJobs(servers)
      await checkVideoAutoBlacklistForModerators(adminBaseParamsServer1, videoUUID, videoName, 'presence')
    })

    it('Should not send video publish notification if auto-blacklisted', async function () {
      await checkVideoIsPublished(userBaseParams, videoName, videoUUID, 'absence')
    })

    it('Should not send a local user subscription notification if auto-blacklisted', async function () {
      await checkNewVideoFromSubscription(adminBaseParamsServer1, videoName, videoUUID, 'absence')
    })

    it('Should not send a remote user subscription notification if auto-blacklisted', async function () {
      await checkNewVideoFromSubscription(adminBaseParamsServer2, videoName, videoUUID, 'absence')
    })

    it('Should send video published and unblacklist after video unblacklisted', async function () {
      this.timeout(20000)

      await removeVideoFromBlacklist(servers[0].url, servers[0].accessToken, videoUUID)

      await waitJobs(servers)

      // FIXME: Can't test as two notifications sent to same user and util only checks last one
      // One notification might be better anyways
      // await checkNewBlacklistOnMyVideo(userBaseParams, videoUUID, videoName, 'unblacklist')
      // await checkVideoIsPublished(userBaseParams, videoName, videoUUID, 'presence')
    })

    it('Should send a local user subscription notification after removed from blacklist', async function () {
      await checkNewVideoFromSubscription(adminBaseParamsServer1, videoName, videoUUID, 'presence')
    })

    it('Should send a remote user subscription notification after removed from blacklist', async function () {
      await checkNewVideoFromSubscription(adminBaseParamsServer2, videoName, videoUUID, 'presence')
    })

    it('Should send unblacklist but not published/subscription notes after unblacklisted if scheduled update pending', async function () {
      this.timeout(20000)

      const updateAt = new Date(new Date().getTime() + 1000000)

      const name = 'video with auto-blacklist and future schedule ' + uuidv4()

      const data = {
        name,
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, data)
      const uuid = resVideo.body.video.uuid

      await removeVideoFromBlacklist(servers[0].url, servers[0].accessToken, uuid)

      await waitJobs(servers)
      await checkNewBlacklistOnMyVideo(userBaseParams, uuid, name, 'unblacklist')

      // FIXME: Can't test absence as two notifications sent to same user and util only checks last one
      // One notification might be better anyways
      // await checkVideoIsPublished(userBaseParams, name, uuid, 'absence')

      await checkNewVideoFromSubscription(adminBaseParamsServer1, name, uuid, 'absence')
      await checkNewVideoFromSubscription(adminBaseParamsServer2, name, uuid, 'absence')
    })

    it('Should not send publish/subscription notifications after scheduled update if video still auto-blacklisted', async function () {
      this.timeout(20000)

      // In 2 seconds
      const updateAt = new Date(new Date().getTime() + 2000)

      const name = 'video with schedule done and still auto-blacklisted ' + uuidv4()

      const data = {
        name,
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }

      const resVideo = await uploadVideo(servers[0].url, userAccessToken, data)
      const uuid = resVideo.body.video.uuid

      await wait(6000)
      await checkVideoIsPublished(userBaseParams, name, uuid, 'absence')
      await checkNewVideoFromSubscription(adminBaseParamsServer1, name, uuid, 'absence')
      await checkNewVideoFromSubscription(adminBaseParamsServer2, name, uuid, 'absence')
    })

    it('Should not send a notification to moderators on new video without auto-blacklist', async function () {
      this.timeout(20000)

      const name = 'video without auto-blacklist ' + uuidv4()

      // admin with blacklist right will not be auto-blacklisted
      const resVideo = await uploadVideo(servers[0].url, servers[0].accessToken, { name })
      const uuid = resVideo.body.video.uuid

      await waitJobs(servers)
      await checkVideoAutoBlacklistForModerators(adminBaseParamsServer1, uuid, name, 'absence')
    })

    after(async () => {
      await updateCustomConfig(servers[0].url, servers[0].accessToken, currentCustomConfig)

      await removeUserSubscription(servers[0].url, servers[0].accessToken, 'user_1_channel@localhost:' + servers[0].port)
      await removeUserSubscription(servers[1].url, servers[1].accessToken, 'user_1_channel@localhost:' + servers[0].port)
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

    it('Should only list read notifications', async function () {
      const res = await getUserNotifications(servers[0].url, userAccessToken, 0, 10, false)

      const notifications = res.body.data as UserNotification[]
      for (const notification of notifications) {
        expect(notification.read).to.be.true
      }
    })

    it('Should only list unread notifications', async function () {
      const res = await getUserNotifications(servers[0].url, userAccessToken, 0, 10, true)

      const notifications = res.body.data as UserNotification[]
      for (const notification of notifications) {
        expect(notification.read).to.be.false
      }
    })

    it('Should mark as read all notifications', async function () {
      await markAsReadAllNotifications(servers[0].url, userAccessToken)

      const res = await getUserNotifications(servers[0].url, userAccessToken, 0, 10, true)

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    })
  })

  describe('Notification settings', function () {
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
      this.timeout(20000)

      await updateMyNotificationSettings(servers[0].url, userAccessToken, immutableAssign(allNotificationSettings, {
        newVideoFromSubscription: UserNotificationSettingValue.NONE
      }))

      {
        const res = await getMyUserInformation(servers[0].url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.NONE)
      }

      const { name, uuid } = await uploadVideoByLocalAccount(servers)

      const check = { web: true, mail: true }
      await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), name, uuid, 'absence')
    })

    it('Should only have web notifications', async function () {
      this.timeout(20000)

      await updateMyNotificationSettings(servers[0].url, userAccessToken, immutableAssign(allNotificationSettings, {
        newVideoFromSubscription: UserNotificationSettingValue.WEB
      }))

      {
        const res = await getMyUserInformation(servers[0].url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.WEB)
      }

      const { name, uuid } = await uploadVideoByLocalAccount(servers)

      {
        const check = { mail: true, web: false }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), name, uuid, 'absence')
      }

      {
        const check = { mail: false, web: true }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), name, uuid, 'presence')
      }
    })

    it('Should only have mail notifications', async function () {
      this.timeout(20000)

      await updateMyNotificationSettings(servers[0].url, userAccessToken, immutableAssign(allNotificationSettings, {
        newVideoFromSubscription: UserNotificationSettingValue.EMAIL
      }))

      {
        const res = await getMyUserInformation(servers[0].url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.EMAIL)
      }

      const { name, uuid } = await uploadVideoByLocalAccount(servers)

      {
        const check = { mail: false, web: true }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), name, uuid, 'absence')
      }

      {
        const check = { mail: true, web: false }
        await checkNewVideoFromSubscription(immutableAssign(baseParams, { check }), name, uuid, 'presence')
      }
    })

    it('Should have email and web notifications', async function () {
      this.timeout(20000)

      await updateMyNotificationSettings(servers[0].url, userAccessToken, immutableAssign(allNotificationSettings, {
        newVideoFromSubscription: UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
      }))

      {
        const res = await getMyUserInformation(servers[0].url, userAccessToken)
        const info = res.body as User
        expect(info.notificationSettings.newVideoFromSubscription).to.equal(
          UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
        )
      }

      const { name, uuid } = await uploadVideoByLocalAccount(servers)

      await checkNewVideoFromSubscription(baseParams, name, uuid, 'presence')
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests(servers)
  })
})
