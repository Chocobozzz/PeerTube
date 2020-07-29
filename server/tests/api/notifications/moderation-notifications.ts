/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { v4 as uuidv4 } from 'uuid'

import {
  addVideoCommentThread,
  addVideoToBlacklist,
  cleanupTests,
  createUser,
  follow,
  generateUserAccessToken,
  getAccount,
  getCustomConfig,
  getVideoCommentThreads,
  getVideoIdFromUUID,
  immutableAssign,
  MockInstancesIndex,
  registerUser,
  removeVideoFromBlacklist,
  reportAbuse,
  unfollow,
  updateCustomConfig,
  updateCustomSubConfig,
  wait,
  updateAbuse,
  addAbuseMessage
} from '../../../../shared/extra-utils'
import { ServerInfo, uploadVideo } from '../../../../shared/extra-utils/index'
import { MockSmtpServer } from '../../../../shared/extra-utils/miscs/email'
import { waitJobs } from '../../../../shared/extra-utils/server/jobs'
import {
  checkAutoInstanceFollowing,
  CheckerBaseParams,
  checkNewAccountAbuseForModerators,
  checkNewBlacklistOnMyVideo,
  checkNewCommentAbuseForModerators,
  checkNewInstanceFollower,
  checkNewVideoAbuseForModerators,
  checkNewVideoFromSubscription,
  checkUserRegistered,
  checkVideoAutoBlacklistForModerators,
  checkVideoIsPublished,
  prepareNotificationsTest,
  checkAbuseStateChange,
  checkNewAbuseMessage
} from '../../../../shared/extra-utils/users/user-notifications'
import { addUserSubscription, removeUserSubscription } from '../../../../shared/extra-utils/users/user-subscriptions'
import { CustomConfig } from '../../../../shared/models/server'
import { UserNotification } from '../../../../shared/models/users'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { AbuseState } from '@shared/models'

describe('Test moderation notifications', function () {
  let servers: ServerInfo[] = []
  let userAccessToken: string
  let userNotifications: UserNotification[] = []
  let adminNotifications: UserNotification[] = []
  let adminNotificationsServer2: UserNotification[] = []
  let emails: object[] = []

  before(async function () {
    this.timeout(120000)

    const res = await prepareNotificationsTest(3)
    emails = res.emails
    userAccessToken = res.userAccessToken
    servers = res.servers
    userNotifications = res.userNotifications
    adminNotifications = res.adminNotifications
    adminNotificationsServer2 = res.adminNotificationsServer2
  })

  describe('Abuse for moderators notification', function () {
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
      this.timeout(20000)

      const name = 'video for abuse ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name })
      const video = resVideo.body.video

      await reportAbuse({ url: servers[0].url, token: servers[0].accessToken, videoId: video.id, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewVideoAbuseForModerators(baseParams, video.uuid, name, 'presence')
    })

    it('Should send a notification to moderators on remote video abuse', async function () {
      this.timeout(20000)

      const name = 'video for abuse ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name })
      const video = resVideo.body.video

      await waitJobs(servers)

      const videoId = await getVideoIdFromUUID(servers[1].url, video.uuid)
      await reportAbuse({ url: servers[1].url, token: servers[1].accessToken, videoId, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewVideoAbuseForModerators(baseParams, video.uuid, name, 'presence')
    })

    it('Should send a notification to moderators on local comment abuse', async function () {
      this.timeout(20000)

      const name = 'video for abuse ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name })
      const video = resVideo.body.video
      const resComment = await addVideoCommentThread(servers[0].url, userAccessToken, video.id, 'comment abuse ' + uuidv4())
      const comment = resComment.body.comment

      await reportAbuse({ url: servers[0].url, token: servers[0].accessToken, commentId: comment.id, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewCommentAbuseForModerators(baseParams, video.uuid, name, 'presence')
    })

    it('Should send a notification to moderators on remote comment abuse', async function () {
      this.timeout(20000)

      const name = 'video for abuse ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name })
      const video = resVideo.body.video
      await addVideoCommentThread(servers[0].url, userAccessToken, video.id, 'comment abuse ' + uuidv4())

      await waitJobs(servers)

      const resComments = await getVideoCommentThreads(servers[1].url, video.uuid, 0, 5)
      const commentId = resComments.body.data[0].id
      await reportAbuse({ url: servers[1].url, token: servers[1].accessToken, commentId, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewCommentAbuseForModerators(baseParams, video.uuid, name, 'presence')
    })

    it('Should send a notification to moderators on local account abuse', async function () {
      this.timeout(20000)

      const username = 'user' + new Date().getTime()
      const resUser = await createUser({ url: servers[0].url, accessToken: servers[0].accessToken, username, password: 'donald' })
      const accountId = resUser.body.user.account.id

      await reportAbuse({ url: servers[0].url, token: servers[0].accessToken, accountId, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewAccountAbuseForModerators(baseParams, username, 'presence')
    })

    it('Should send a notification to moderators on remote account abuse', async function () {
      this.timeout(20000)

      const username = 'user' + new Date().getTime()
      const tmpToken = await generateUserAccessToken(servers[0], username)
      await uploadVideo(servers[0].url, tmpToken, { name: 'super video' })

      await waitJobs(servers)

      const resAccount = await getAccount(servers[1].url, username + '@' + servers[0].host)
      await reportAbuse({ url: servers[1].url, token: servers[1].accessToken, accountId: resAccount.body.id, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewAccountAbuseForModerators(baseParams, username, 'presence')
    })
  })

  describe('Abuse state change notification', function () {
    let baseParams: CheckerBaseParams
    let abuseId: number

    before(async function () {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }

      const name = 'abuse ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name })
      const video = resVideo.body.video

      const res = await reportAbuse({ url: servers[0].url, token: userAccessToken, videoId: video.id, reason: 'super reason' })
      abuseId = res.body.abuse.id
    })

    it('Should send a notification to reporter if the abuse has been accepted', async function () {
      this.timeout(10000)

      await updateAbuse(servers[0].url, servers[0].accessToken, abuseId, { state: AbuseState.ACCEPTED })
      await waitJobs(servers)

      await checkAbuseStateChange(baseParams, abuseId, AbuseState.ACCEPTED, 'presence')
    })

    it('Should send a notification to reporter if the abuse has been rejected', async function () {
      this.timeout(10000)

      await updateAbuse(servers[0].url, servers[0].accessToken, abuseId, { state: AbuseState.REJECTED })
      await waitJobs(servers)

      await checkAbuseStateChange(baseParams, abuseId, AbuseState.REJECTED, 'presence')
    })
  })

  describe('New abuse message notification', function () {
    let baseParamsUser: CheckerBaseParams
    let baseParamsAdmin: CheckerBaseParams
    let abuseId: number
    let abuseId2: number

    before(async function () {
      baseParamsUser = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userAccessToken
      }

      baseParamsAdmin = {
        server: servers[0],
        emails,
        socketNotifications: adminNotifications,
        token: servers[0].accessToken
      }

      const name = 'abuse ' + uuidv4()
      const resVideo = await uploadVideo(servers[0].url, userAccessToken, { name })
      const video = resVideo.body.video

      {
        const res = await reportAbuse({ url: servers[0].url, token: userAccessToken, videoId: video.id, reason: 'super reason' })
        abuseId = res.body.abuse.id
      }

      {
        const res = await reportAbuse({ url: servers[0].url, token: userAccessToken, videoId: video.id, reason: 'super reason 2' })
        abuseId2 = res.body.abuse.id
      }
    })

    it('Should send a notification to reporter on new message', async function () {
      this.timeout(10000)

      const message = 'my super message to users'
      await addAbuseMessage(servers[0].url, servers[0].accessToken, abuseId, message)
      await waitJobs(servers)

      await checkNewAbuseMessage(baseParamsUser, abuseId, message, 'user_1@example.com', 'presence')
    })

    it('Should not send a notification to the admin if sent by the admin', async function () {
      this.timeout(10000)

      const message = 'my super message that should not be sent to the admin'
      await addAbuseMessage(servers[0].url, servers[0].accessToken, abuseId, message)
      await waitJobs(servers)

      await checkNewAbuseMessage(baseParamsAdmin, abuseId, message, 'admin' + servers[0].internalServerNumber + '@example.com', 'absence')
    })

    it('Should send a notification to moderators', async function () {
      this.timeout(10000)

      const message = 'my super message to moderators'
      await addAbuseMessage(servers[0].url, userAccessToken, abuseId2, message)
      await waitJobs(servers)

      await checkNewAbuseMessage(baseParamsAdmin, abuseId2, message, 'admin' + servers[0].internalServerNumber + '@example.com', 'presence')
    })

    it('Should not send a notification to reporter if sent by the reporter', async function () {
      this.timeout(10000)

      const message = 'my super message that should not be sent to reporter'
      await addAbuseMessage(servers[0].url, userAccessToken, abuseId2, message)
      await waitJobs(servers)

      await checkNewAbuseMessage(baseParamsUser, abuseId2, message, 'user_1@example.com', 'absence')
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

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests(servers)
  })
})
