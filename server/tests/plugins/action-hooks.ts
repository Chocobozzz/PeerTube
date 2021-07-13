/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
  cleanupTests,
  flushAndRunMultipleServers,
  killallServers,
  PluginsCommand,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateVideo,
  uploadVideo,
  viewVideo
} from '@shared/extra-utils'
import { ServerHookName, VideoPlaylistPrivacy, VideoPrivacy } from '@shared/models'

describe('Test plugin action hooks', function () {
  let servers: ServerInfo[]
  let videoUUID: string
  let threadId: number

  function checkHook (hook: ServerHookName) {
    return servers[0].serversCommand.waitUntilLog('Run hook ' + hook)
  }

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await servers[0].pluginsCommand.install({ path: PluginsCommand.getPluginTestPath() })

    await killallServers([ servers[0] ])

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

      await servers[0].liveCommand.create({ fields: attributes })

      await checkHook('action:api.live-video.created')
    })
  })

  describe('Comments hooks', function () {
    it('Should run action:api.video-thread.created', async function () {
      const created = await servers[0].commentsCommand.createThread({ videoId: videoUUID, text: 'thread' })
      threadId = created.id

      await checkHook('action:api.video-thread.created')
    })

    it('Should run action:api.video-comment-reply.created', async function () {
      await servers[0].commentsCommand.addReply({ videoId: videoUUID, toCommentId: threadId, text: 'reply' })

      await checkHook('action:api.video-comment-reply.created')
    })

    it('Should run action:api.video-comment.deleted', async function () {
      await servers[0].commentsCommand.delete({ videoId: videoUUID, commentId: threadId })

      await checkHook('action:api.video-comment.deleted')
    })
  })

  describe('Users hooks', function () {
    let userId: number

    it('Should run action:api.user.registered', async function () {
      await servers[0].usersCommand.register({ username: 'registered_user' })

      await checkHook('action:api.user.registered')
    })

    it('Should run action:api.user.created', async function () {
      const user = await servers[0].usersCommand.create({ username: 'created_user' })
      userId = user.id

      await checkHook('action:api.user.created')
    })

    it('Should run action:api.user.oauth2-got-token', async function () {
      await servers[0].loginCommand.getAccessToken('created_user', 'super_password')

      await checkHook('action:api.user.oauth2-got-token')
    })

    it('Should run action:api.user.blocked', async function () {
      await servers[0].usersCommand.banUser({ userId })

      await checkHook('action:api.user.blocked')
    })

    it('Should run action:api.user.unblocked', async function () {
      await servers[0].usersCommand.unbanUser({ userId })

      await checkHook('action:api.user.unblocked')
    })

    it('Should run action:api.user.updated', async function () {
      await servers[0].usersCommand.update({ userId, videoQuota: 50 })

      await checkHook('action:api.user.updated')
    })

    it('Should run action:api.user.deleted', async function () {
      await servers[0].usersCommand.remove({ userId })

      await checkHook('action:api.user.deleted')
    })
  })

  describe('Playlist hooks', function () {
    let playlistId: number
    let videoId: number

    before(async function () {
      {
        const { id } = await servers[0].playlistsCommand.create({
          attributes: {
            displayName: 'My playlist',
            privacy: VideoPlaylistPrivacy.PRIVATE
          }
        })
        playlistId = id
      }

      {
        const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'my super name' })
        videoId = res.body.video.id
      }
    })

    it('Should run action:api.video-playlist-element.created', async function () {
      await servers[0].playlistsCommand.addElement({ playlistId, attributes: { videoId } })

      await checkHook('action:api.video-playlist-element.created')
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
