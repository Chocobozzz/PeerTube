/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { ServerHookName, VideoPlaylistPrivacy, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  killallServers,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test plugin action hooks', function () {
  let servers: PeerTubeServer[]
  let videoUUID: string
  let threadId: number

  function checkHook (hook: ServerHookName, strictCount = true, count = 1) {
    return servers[0].servers.waitUntilLog('Run hook ' + hook, count, strictCount)
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await servers[0].plugins.install({ path: PluginsCommand.getPluginTestPath() })

    await killallServers([ servers[0] ])

    await servers[0].run({
      live: {
        enabled: true
      }
    })

    await servers[0].config.enableFileUpdate()

    await doubleFollow(servers[0], servers[1])
  })

  describe('Application hooks', function () {
    it('Should run action:application.listening', async function () {
      await checkHook('action:application.listening')
    })
  })

  describe('Videos hooks', function () {

    it('Should run action:api.video.uploaded', async function () {
      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video' } })
      videoUUID = uuid

      await checkHook('action:api.video.uploaded')
    })

    it('Should run action:api.video.updated', async function () {
      await servers[0].videos.update({ id: videoUUID, attributes: { name: 'video updated' } })

      await checkHook('action:api.video.updated')
    })

    it('Should run action:api.video.viewed', async function () {
      await servers[0].views.simulateView({ id: videoUUID })

      await checkHook('action:api.video.viewed')
    })

    it('Should run action:api.video.file-updated', async function () {
      await servers[0].videos.replaceSourceFile({ videoId: videoUUID, fixture: 'video_short.mp4' })

      await checkHook('action:api.video.file-updated')
    })

    it('Should run action:api.video.deleted', async function () {
      await servers[0].videos.remove({ id: videoUUID })

      await checkHook('action:api.video.deleted')
    })

    after(async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      videoUUID = uuid
    })
  })

  describe('Video channel hooks', function () {
    const channelName = 'my_super_channel'

    it('Should run action:api.video-channel.created', async function () {
      await servers[0].channels.create({ attributes: { name: channelName } })

      await checkHook('action:api.video-channel.created')
    })

    it('Should run action:api.video-channel.updated', async function () {
      await servers[0].channels.update({ channelName, attributes: { displayName: 'my display name' } })

      await checkHook('action:api.video-channel.updated')
    })

    it('Should run action:api.video-channel.deleted', async function () {
      await servers[0].channels.delete({ channelName })

      await checkHook('action:api.video-channel.deleted')
    })
  })

  describe('Live hooks', function () {

    it('Should run action:api.live-video.created', async function () {
      const attributes = {
        name: 'live',
        privacy: VideoPrivacy.PUBLIC,
        channelId: servers[0].store.channel.id
      }

      await servers[0].live.create({ fields: attributes })

      await checkHook('action:api.live-video.created')
    })

    it('Should run action:live.video.state.updated', async function () {
      this.timeout(60000)

      const attributes = {
        name: 'live',
        privacy: VideoPrivacy.PUBLIC,
        channelId: servers[0].store.channel.id
      }

      const { uuid: liveVideoId } = await servers[0].live.create({ fields: attributes })
      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoId })
      await servers[0].live.waitUntilPublished({ videoId: liveVideoId })
      await waitJobs(servers)

      await checkHook('action:live.video.state.updated', true, 1)

      await stopFfmpeg(ffmpegCommand)
      await servers[0].live.waitUntilEnded({ videoId: liveVideoId })
      await waitJobs(servers)

      await checkHook('action:live.video.state.updated', true, 2)
    })
  })

  describe('Comments hooks', function () {
    it('Should run action:api.video-thread.created', async function () {
      const created = await servers[0].comments.createThread({ videoId: videoUUID, text: 'thread' })
      threadId = created.id

      await checkHook('action:api.video-thread.created')
    })

    it('Should run action:api.video-comment-reply.created', async function () {
      await servers[0].comments.addReply({ videoId: videoUUID, toCommentId: threadId, text: 'reply' })

      await checkHook('action:api.video-comment-reply.created')
    })

    it('Should run action:api.video-comment.deleted', async function () {
      await servers[0].comments.delete({ videoId: videoUUID, commentId: threadId })

      await checkHook('action:api.video-comment.deleted')
    })
  })

  describe('Captions hooks', function () {
    it('Should run action:api.video-caption.created', async function () {
      await servers[0].captions.add({ videoId: videoUUID, language: 'en', fixture: 'subtitle-good.srt' })

      await checkHook('action:api.video-caption.created')
    })

    it('Should run action:api.video-caption.deleted', async function () {
      await servers[0].captions.delete({ videoId: videoUUID, language: 'en' })

      await checkHook('action:api.video-caption.deleted')
    })
  })

  describe('Users hooks', function () {
    let userId: number

    it('Should run action:api.user.registered', async function () {
      await servers[0].registrations.register({ username: 'registered_user' })

      await checkHook('action:api.user.registered')
    })

    it('Should run action:api.user.created', async function () {
      const user = await servers[0].users.create({ username: 'created_user' })
      userId = user.id

      await checkHook('action:api.user.created')
    })

    it('Should run action:api.user.oauth2-got-token', async function () {
      await servers[0].login.login({ user: { username: 'created_user' } })

      await checkHook('action:api.user.oauth2-got-token')
    })

    it('Should run action:api.user.blocked', async function () {
      await servers[0].users.banUser({ userId })

      await checkHook('action:api.user.blocked')
    })

    it('Should run action:api.user.unblocked', async function () {
      await servers[0].users.unbanUser({ userId })

      await checkHook('action:api.user.unblocked')
    })

    it('Should run action:api.user.updated', async function () {
      await servers[0].users.update({ userId, videoQuota: 50 })

      await checkHook('action:api.user.updated')
    })

    it('Should run action:api.user.deleted', async function () {
      await servers[0].users.remove({ userId })

      await checkHook('action:api.user.deleted')
    })

    it('Should run action:api.user.deleted upon delete me', async function () {
      const token = await servers[0].users.generateUserAndToken('delete_me_user')
      await servers[0].users.deleteMe({ token })

      await checkHook('action:api.user.deleted', true, 2)
    })
  })

  describe('Playlist hooks', function () {
    let playlistId: number
    let videoId: number

    before(async function () {
      {
        const { id } = await servers[0].playlists.create({
          attributes: {
            displayName: 'My playlist',
            privacy: VideoPlaylistPrivacy.PRIVATE
          }
        })
        playlistId = id
      }

      {
        const { id } = await servers[0].videos.upload({ attributes: { name: 'my super name' } })
        videoId = id
      }
    })

    it('Should run action:api.video-playlist-element.created', async function () {
      await servers[0].playlists.addElement({ playlistId, attributes: { videoId } })

      await checkHook('action:api.video-playlist-element.created')
    })
  })

  describe('Notification hook', function () {

    it('Should run action:notifier.notification.created', async function () {
      await checkHook('action:notifier.notification.created', false)
    })
  })

  describe('Activity Pub hooks', function () {
    let videoUUID: string

    it('Should run action:activity-pub.remote-video.created', async function () {
      this.timeout(30000)

      const { uuid } = await servers[1].videos.quickUpload({ name: 'remote video' })
      videoUUID = uuid

      await servers[0].servers.waitUntilLog('action:activity-pub.remote-video.created - AP remote video - video remote video')
    })

    it('Should run action:activity-pub.remote-video.updated', async function () {
      this.timeout(30000)

      await servers[1].videos.update({ id: videoUUID, attributes: { name: 'remote video updated' } })

      await servers[0].servers.waitUntilLog(
        'action:activity-pub.remote-video.updated - AP remote video updated - video remote video updated',
        1,
        false
      )
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
