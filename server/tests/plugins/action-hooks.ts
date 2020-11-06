/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { ServerHookName, VideoPrivacy } from '@shared/models'
import {
  addVideoCommentReply,
  addVideoCommentThread,
  blockUser,
  createLive,
  createUser,
  deleteVideoComment,
  getPluginTestPath,
  installPlugin,
  registerUser,
  removeUser,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  unblockUser,
  updateUser,
  updateVideo,
  uploadVideo,
  userLogin,
  viewVideo
} from '../../../shared/extra-utils'
import {
  cleanupTests,
  flushAndRunMultipleServers,
  killallServers,
  reRunServer,
  ServerInfo,
  waitUntilLog
} from '../../../shared/extra-utils/server/servers'

describe('Test plugin action hooks', function () {
  let servers: ServerInfo[]
  let videoUUID: string
  let threadId: number

  function checkHook (hook: ServerHookName) {
    return waitUntilLog(servers[0], 'Run hook ' + hook)
  }

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await installPlugin({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      path: getPluginTestPath()
    })

    killallServers([ servers[0] ])

    await reRunServer(servers[0], {
      live: {
        enabled: true
      }
    })
  })

  describe('Application hooks', function () {
    it('Should run action:application.listening', async function () {
      await checkHook('action:application.listening')
    })
  })

  describe('Videos hooks', function () {
    it('Should run action:api.video.uploaded', async function () {
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video' })
      videoUUID = res.body.video.uuid

      await checkHook('action:api.video.uploaded')
    })

    it('Should run action:api.video.updated', async function () {
      await updateVideo(servers[0].url, servers[0].accessToken, videoUUID, { name: 'video updated' })

      await checkHook('action:api.video.updated')
    })

    it('Should run action:api.video.viewed', async function () {
      await viewVideo(servers[0].url, videoUUID)

      await checkHook('action:api.video.viewed')
    })
  })

  describe('Live hooks', function () {

    it('Should run action:api.live-video.created', async function () {
      const attributes = {
        name: 'live',
        privacy: VideoPrivacy.PUBLIC,
        channelId: servers[0].videoChannel.id
      }

      await createLive(servers[0].url, servers[0].accessToken, attributes)

      await checkHook('action:api.live-video.created')
    })
  })

  describe('Comments hooks', function () {
    it('Should run action:api.video-thread.created', async function () {
      const res = await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, 'thread')
      threadId = res.body.comment.id

      await checkHook('action:api.video-thread.created')
    })

    it('Should run action:api.video-comment-reply.created', async function () {
      await addVideoCommentReply(servers[0].url, servers[0].accessToken, videoUUID, threadId, 'reply')

      await checkHook('action:api.video-comment-reply.created')
    })

    it('Should run action:api.video-comment.deleted', async function () {
      await deleteVideoComment(servers[0].url, servers[0].accessToken, videoUUID, threadId)

      await checkHook('action:api.video-comment.deleted')
    })
  })

  describe('Users hooks', function () {
    let userId: number

    it('Should run action:api.user.registered', async function () {
      await registerUser(servers[0].url, 'registered_user', 'super_password')

      await checkHook('action:api.user.registered')
    })

    it('Should run action:api.user.created', async function () {
      const res = await createUser({
        url: servers[0].url,
        accessToken: servers[0].accessToken,
        username: 'created_user',
        password: 'super_password'
      })
      userId = res.body.user.id

      await checkHook('action:api.user.created')
    })

    it('Should run action:api.user.oauth2-got-token', async function () {
      await userLogin(servers[0], { username: 'created_user', password: 'super_password' })

      await checkHook('action:api.user.oauth2-got-token')
    })

    it('Should run action:api.user.blocked', async function () {
      await blockUser(servers[0].url, userId, servers[0].accessToken)

      await checkHook('action:api.user.blocked')
    })

    it('Should run action:api.user.unblocked', async function () {
      await unblockUser(servers[0].url, userId, servers[0].accessToken)

      await checkHook('action:api.user.unblocked')
    })

    it('Should run action:api.user.updated', async function () {
      await updateUser({ url: servers[0].url, accessToken: servers[0].accessToken, userId, videoQuota: 50 })

      await checkHook('action:api.user.updated')
    })

    it('Should run action:api.user.deleted', async function () {
      await removeUser(servers[0].url, userId, servers[0].accessToken)

      await checkHook('action:api.user.deleted')
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
