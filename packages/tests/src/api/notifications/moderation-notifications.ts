/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { AbuseState, UserNotification, UserRole, VideoPrivacy } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { cleanupTests, PeerTubeServer, waitJobs } from '@peertube/peertube-server-commands'
import { MockSmtpServer } from '@tests/shared/mock-servers/mock-email.js'
import { MockInstancesIndex } from '@tests/shared/mock-servers/mock-instances-index.js'
import {
  prepareNotificationsTest,
  CheckerBaseParams,
  checkNewVideoAbuseForModerators,
  checkNewCommentAbuseForModerators,
  checkNewAccountAbuseForModerators,
  checkAbuseStateChange,
  checkNewAbuseMessage,
  checkNewBlacklistOnMyVideo,
  checkNewInstanceFollower,
  checkAutoInstanceFollowing,
  checkVideoAutoBlacklistForModerators,
  checkMyVideoIsPublished,
  checkNewVideoFromSubscription
} from '@tests/shared/notifications.js'

describe('Test moderation notifications', function () {
  let servers: PeerTubeServer[] = []
  let userToken1: string
  let userToken2: string

  let userNotifications: UserNotification[] = []
  let adminNotifications: UserNotification[] = []
  let adminNotificationsServer2: UserNotification[] = []
  let emails: object[] = []

  before(async function () {
    this.timeout(120000)

    const res = await prepareNotificationsTest(3)
    emails = res.emails
    userToken1 = res.userAccessToken
    servers = res.servers
    userNotifications = res.userNotifications
    adminNotifications = res.adminNotifications
    adminNotificationsServer2 = res.adminNotificationsServer2

    userToken2 = await servers[1].users.generateUserAndToken('user2', UserRole.USER)
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

    it('Should not send a notification to moderators on local abuse reported by an admin', async function () {
      this.timeout(50000)

      const name = 'video for abuse ' + buildUUID()
      const video = await servers[0].videos.upload({ token: userToken1, attributes: { name } })

      await servers[0].abuses.report({ videoId: video.id, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewVideoAbuseForModerators({ ...baseParams, shortUUID: video.shortUUID, videoName: name, checkType: 'absence' })
    })

    it('Should send a notification to moderators on local video abuse', async function () {
      this.timeout(50000)

      const name = 'video for abuse ' + buildUUID()
      const video = await servers[0].videos.upload({ token: userToken1, attributes: { name } })

      await servers[0].abuses.report({ token: userToken1, videoId: video.id, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewVideoAbuseForModerators({ ...baseParams, shortUUID: video.shortUUID, videoName: name, checkType: 'presence' })
    })

    it('Should send a notification to moderators on remote video abuse', async function () {
      this.timeout(50000)

      const name = 'video for abuse ' + buildUUID()
      const video = await servers[0].videos.upload({ token: userToken1, attributes: { name } })

      await waitJobs(servers)

      const videoId = await servers[1].videos.getId({ uuid: video.uuid })
      await servers[1].abuses.report({ token: userToken2, videoId, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewVideoAbuseForModerators({ ...baseParams, shortUUID: video.shortUUID, videoName: name, checkType: 'presence' })
    })

    it('Should send a notification to moderators on local comment abuse', async function () {
      this.timeout(50000)

      const name = 'video for abuse ' + buildUUID()
      const video = await servers[0].videos.upload({ token: userToken1, attributes: { name } })
      const comment = await servers[0].comments.createThread({
        token: userToken1,
        videoId: video.id,
        text: 'comment abuse ' + buildUUID()
      })

      await waitJobs(servers)

      await servers[0].abuses.report({ token: userToken1, commentId: comment.id, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewCommentAbuseForModerators({ ...baseParams, shortUUID: video.shortUUID, videoName: name, checkType: 'presence' })
    })

    it('Should send a notification to moderators on remote comment abuse', async function () {
      this.timeout(50000)

      const name = 'video for abuse ' + buildUUID()
      const video = await servers[0].videos.upload({ token: userToken1, attributes: { name } })

      await servers[0].comments.createThread({
        token: userToken1,
        videoId: video.id,
        text: 'comment abuse ' + buildUUID()
      })

      await waitJobs(servers)

      const { data } = await servers[1].comments.listThreads({ videoId: video.uuid })
      const commentId = data[0].id
      await servers[1].abuses.report({ token: userToken2, commentId, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewCommentAbuseForModerators({ ...baseParams, shortUUID: video.shortUUID, videoName: name, checkType: 'presence' })
    })

    it('Should send a notification to moderators on local account abuse', async function () {
      this.timeout(50000)

      const username = 'user' + new Date().getTime()
      const { account } = await servers[0].users.create({ username, password: 'donald' })
      const accountId = account.id

      await servers[0].abuses.report({ token: userToken1, accountId, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewAccountAbuseForModerators({ ...baseParams, displayName: username, checkType: 'presence' })
    })

    it('Should send a notification to moderators on remote account abuse', async function () {
      this.timeout(50000)

      const username = 'user' + new Date().getTime()
      const tmpToken = await servers[0].users.generateUserAndToken(username)
      await servers[0].videos.upload({ token: tmpToken, attributes: { name: 'super video' } })

      await waitJobs(servers)

      const account = await servers[1].accounts.get({ accountName: username + '@' + servers[0].host })
      await servers[1].abuses.report({ token: userToken2, accountId: account.id, reason: 'super reason' })

      await waitJobs(servers)
      await checkNewAccountAbuseForModerators({ ...baseParams, displayName: username, checkType: 'presence' })
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
        token: userToken1
      }

      const name = 'abuse ' + buildUUID()
      const video = await servers[0].videos.upload({ token: userToken1, attributes: { name } })

      const body = await servers[0].abuses.report({ token: userToken1, videoId: video.id, reason: 'super reason' })
      abuseId = body.abuse.id
    })

    it('Should send a notification to reporter if the abuse has been accepted', async function () {
      this.timeout(30000)

      await servers[0].abuses.update({ abuseId, body: { state: AbuseState.ACCEPTED } })
      await waitJobs(servers)

      await checkAbuseStateChange({ ...baseParams, abuseId, state: AbuseState.ACCEPTED, checkType: 'presence' })
    })

    it('Should send a notification to reporter if the abuse has been rejected', async function () {
      this.timeout(30000)

      await servers[0].abuses.update({ abuseId, body: { state: AbuseState.REJECTED } })
      await waitJobs(servers)

      await checkAbuseStateChange({ ...baseParams, abuseId, state: AbuseState.REJECTED, checkType: 'presence' })
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
        token: userToken1
      }

      baseParamsAdmin = {
        server: servers[0],
        emails,
        socketNotifications: adminNotifications,
        token: servers[0].accessToken
      }

      const name = 'abuse ' + buildUUID()
      const video = await servers[0].videos.upload({ token: userToken1, attributes: { name } })

      {
        const body = await servers[0].abuses.report({ token: userToken1, videoId: video.id, reason: 'super reason' })
        abuseId = body.abuse.id
      }

      {
        const body = await servers[0].abuses.report({ token: userToken1, videoId: video.id, reason: 'super reason 2' })
        abuseId2 = body.abuse.id
      }
    })

    it('Should send a notification to reporter on new message', async function () {
      this.timeout(30000)

      const message = 'my super message to users'
      await servers[0].abuses.addMessage({ abuseId, message })
      await waitJobs(servers)

      await checkNewAbuseMessage({ ...baseParamsUser, abuseId, message, toEmail: 'user_1@example.com', checkType: 'presence' })
    })

    it('Should not send a notification to the admin if sent by the admin', async function () {
      this.timeout(30000)

      const message = 'my super message that should not be sent to the admin'
      await servers[0].abuses.addMessage({ abuseId, message })
      await waitJobs(servers)

      const toEmail = 'admin' + servers[0].internalServerNumber + '@example.com'
      await checkNewAbuseMessage({ ...baseParamsAdmin, abuseId, message, toEmail, checkType: 'absence' })
    })

    it('Should send a notification to moderators', async function () {
      this.timeout(30000)

      const message = 'my super message to moderators'
      await servers[0].abuses.addMessage({ token: userToken1, abuseId: abuseId2, message })
      await waitJobs(servers)

      const toEmail = 'admin' + servers[0].internalServerNumber + '@example.com'
      await checkNewAbuseMessage({ ...baseParamsAdmin, abuseId: abuseId2, message, toEmail, checkType: 'presence' })
    })

    it('Should not send a notification to reporter if sent by the reporter', async function () {
      this.timeout(30000)

      const message = 'my super message that should not be sent to reporter'
      await servers[0].abuses.addMessage({ token: userToken1, abuseId: abuseId2, message })
      await waitJobs(servers)

      const toEmail = 'user_1@example.com'
      await checkNewAbuseMessage({ ...baseParamsUser, abuseId: abuseId2, message, toEmail, checkType: 'absence' })
    })
  })

  describe('Video blacklist on my video', function () {
    let baseParams: CheckerBaseParams

    before(() => {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: userNotifications,
        token: userToken1
      }
    })

    it('Should send a notification to video owner on blacklist', async function () {
      this.timeout(30000)

      const name = 'video for abuse ' + buildUUID()
      const { uuid, shortUUID } = await servers[0].videos.upload({ token: userToken1, attributes: { name } })

      await servers[0].blacklist.add({ videoId: uuid })

      await waitJobs(servers)
      await checkNewBlacklistOnMyVideo({ ...baseParams, shortUUID, videoName: name, blacklistType: 'blacklist' })
    })

    it('Should send a notification to video owner on unblacklist', async function () {
      this.timeout(30000)

      const name = 'video for abuse ' + buildUUID()
      const { uuid, shortUUID } = await servers[0].videos.upload({ token: userToken1, attributes: { name } })

      await servers[0].blacklist.add({ videoId: uuid })

      await waitJobs(servers)
      await servers[0].blacklist.remove({ videoId: uuid })
      await waitJobs(servers)

      await wait(500)
      await checkNewBlacklistOnMyVideo({ ...baseParams, shortUUID, videoName: name, blacklistType: 'unblacklist' })
    })
  })

  describe('New instance follows', function () {
    const instanceIndexServer = new MockInstancesIndex()
    let config: any
    let baseParams: CheckerBaseParams

    before(async function () {
      baseParams = {
        server: servers[0],
        emails,
        socketNotifications: adminNotifications,
        token: servers[0].accessToken
      }

      const port = await instanceIndexServer.initialize()
      instanceIndexServer.addInstance(servers[1].host)

      config = {
        followings: {
          instance: {
            autoFollowIndex: {
              indexUrl: `http://127.0.0.1:${port}/api/v1/instances/hosts`,
              enabled: true
            }
          }
        }
      }
    })

    it('Should send a notification only to admin when there is a new instance follower', async function () {
      this.timeout(60000)

      await servers[2].follows.follow({ hosts: [ servers[0].url ] })

      await waitJobs(servers)

      await checkNewInstanceFollower({ ...baseParams, followerHost: servers[2].host, checkType: 'presence' })

      const userOverride = { socketNotifications: userNotifications, token: userToken1, check: { web: true, mail: false } }
      await checkNewInstanceFollower({ ...baseParams, ...userOverride, followerHost: servers[2].host, checkType: 'absence' })
    })

    it('Should send a notification on auto follow back', async function () {
      this.timeout(40000)

      await servers[2].follows.unfollow({ target: servers[0] })
      await waitJobs(servers)

      const config = {
        followings: {
          instance: {
            autoFollowBack: { enabled: true }
          }
        }
      }
      await servers[0].config.updateExistingConfig({ newConfig: config })

      await servers[2].follows.follow({ hosts: [ servers[0].url ] })

      await waitJobs(servers)

      const followerHost = servers[0].host
      const followingHost = servers[2].host
      await checkAutoInstanceFollowing({ ...baseParams, followerHost, followingHost, checkType: 'presence' })

      const userOverride = { socketNotifications: userNotifications, token: userToken1, check: { web: true, mail: false } }
      await checkAutoInstanceFollowing({ ...baseParams, ...userOverride, followerHost, followingHost, checkType: 'absence' })

      config.followings.instance.autoFollowBack.enabled = false
      await servers[0].config.updateExistingConfig({ newConfig: config })
      await servers[0].follows.unfollow({ target: servers[2] })
      await servers[2].follows.unfollow({ target: servers[0] })
    })

    it('Should send a notification on auto instances index follow', async function () {
      this.timeout(30000)
      await servers[0].follows.unfollow({ target: servers[1] })

      await servers[0].config.updateExistingConfig({ newConfig: config })

      await wait(5000)
      await waitJobs(servers)

      const followerHost = servers[0].host
      const followingHost = servers[1].host
      await checkAutoInstanceFollowing({ ...baseParams, followerHost, followingHost, checkType: 'presence' })

      config.followings.instance.autoFollowIndex.enabled = false
      await servers[0].config.updateExistingConfig({ newConfig: config })
      await servers[0].follows.unfollow({ target: servers[1] })
    })
  })

  describe('Video-related notifications when video auto-blacklist is enabled', function () {
    let userBaseParams: CheckerBaseParams
    let adminBaseParamsServer1: CheckerBaseParams
    let adminBaseParamsServer2: CheckerBaseParams
    let uuid: string
    let shortUUID: string
    let videoName: string

    before(async function () {

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
        token: userToken1
      }

      await servers[0].config.enableAutoBlacklist()

      await servers[0].subscriptions.add({ targetUri: 'user_1_channel@' + servers[0].host })
      await servers[1].subscriptions.add({ targetUri: 'user_1_channel@' + servers[0].host })
    })

    it('Should send notification to moderators on new video with auto-blacklist', async function () {
      this.timeout(120000)

      videoName = 'video with auto-blacklist ' + buildUUID()
      const video = await servers[0].videos.upload({ token: userToken1, attributes: { name: videoName } })
      shortUUID = video.shortUUID
      uuid = video.uuid

      await waitJobs(servers)
      await checkVideoAutoBlacklistForModerators({ ...adminBaseParamsServer1, shortUUID, videoName, checkType: 'presence' })
    })

    it('Should not send video publish notification if auto-blacklisted', async function () {
      this.timeout(120000)

      await checkMyVideoIsPublished({ ...userBaseParams, videoName, shortUUID, checkType: 'absence' })
    })

    it('Should not send a local user subscription notification if auto-blacklisted', async function () {
      this.timeout(120000)

      await checkNewVideoFromSubscription({ ...adminBaseParamsServer1, videoName, shortUUID, checkType: 'absence' })
    })

    it('Should not send a remote user subscription notification if auto-blacklisted', async function () {
      await checkNewVideoFromSubscription({ ...adminBaseParamsServer2, videoName, shortUUID, checkType: 'absence' })
    })

    it('Should send video published and unblacklist after video unblacklisted', async function () {
      this.timeout(120000)

      await servers[0].blacklist.remove({ videoId: uuid })

      await waitJobs(servers)

      // FIXME: Can't test as two notifications sent to same user and util only checks last one
      // One notification might be better anyways
      // await checkNewBlacklistOnMyVideo(userBaseParams, videoUUID, videoName, 'unblacklist')
      // await checkVideoIsPublished(userBaseParams, videoName, videoUUID, 'presence')
    })

    it('Should send a local user subscription notification after removed from blacklist', async function () {
      this.timeout(120000)

      await checkNewVideoFromSubscription({ ...adminBaseParamsServer1, videoName, shortUUID, checkType: 'presence' })
    })

    it('Should send a remote user subscription notification after removed from blacklist', async function () {
      this.timeout(120000)

      await checkNewVideoFromSubscription({ ...adminBaseParamsServer2, videoName, shortUUID, checkType: 'presence' })
    })

    it('Should send unblacklist but not published/subscription notes after unblacklisted if scheduled update pending', async function () {
      this.timeout(120000)

      const updateAt = new Date(new Date().getTime() + 1000000)

      const name = 'video with auto-blacklist and future schedule ' + buildUUID()

      const attributes = {
        name,
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }

      const { shortUUID, uuid } = await servers[0].videos.upload({ token: userToken1, attributes })

      await servers[0].blacklist.remove({ videoId: uuid })

      await waitJobs(servers)
      await checkNewBlacklistOnMyVideo({ ...userBaseParams, shortUUID, videoName: name, blacklistType: 'unblacklist' })

      // FIXME: Can't test absence as two notifications sent to same user and util only checks last one
      // One notification might be better anyways
      // await checkVideoIsPublished(userBaseParams, name, uuid, 'absence')

      await checkNewVideoFromSubscription({ ...adminBaseParamsServer1, videoName: name, shortUUID, checkType: 'absence' })
      await checkNewVideoFromSubscription({ ...adminBaseParamsServer2, videoName: name, shortUUID, checkType: 'absence' })
    })

    it('Should not send publish/subscription notifications after scheduled update if video still auto-blacklisted', async function () {
      this.timeout(120000)

      // In 2 seconds
      const updateAt = new Date(new Date().getTime() + 2000)

      const name = 'video with schedule done and still auto-blacklisted ' + buildUUID()

      const attributes = {
        name,
        privacy: VideoPrivacy.PRIVATE,
        scheduleUpdate: {
          updateAt: updateAt.toISOString(),
          privacy: VideoPrivacy.PUBLIC
        }
      }

      const { shortUUID } = await servers[0].videos.upload({ token: userToken1, attributes })

      await wait(6000)
      await checkMyVideoIsPublished({ ...userBaseParams, videoName: name, shortUUID, checkType: 'absence' })
      await checkNewVideoFromSubscription({ ...adminBaseParamsServer1, videoName: name, shortUUID, checkType: 'absence' })
      await checkNewVideoFromSubscription({ ...adminBaseParamsServer2, videoName: name, shortUUID, checkType: 'absence' })
    })

    it('Should not send a notification to moderators on new video without auto-blacklist', async function () {
      this.timeout(120000)

      const name = 'video without auto-blacklist ' + buildUUID()

      // admin with blacklist right will not be auto-blacklisted
      const { shortUUID } = await servers[0].videos.upload({ attributes: { name } })

      await waitJobs(servers)
      await checkVideoAutoBlacklistForModerators({ ...adminBaseParamsServer1, shortUUID, videoName: name, checkType: 'absence' })
    })

    after(async () => {
      await servers[0].subscriptions.remove({ uri: 'user_1_channel@' + servers[0].host })
      await servers[1].subscriptions.remove({ uri: 'user_1_channel@' + servers[0].host })
    })
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests(servers)
  })
})
