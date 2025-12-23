/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  LiveVideoLatencyMode,
  VideoChannelActivityAction,
  VideoChannelActivityTarget,
  VideoCreateResult,
  VideoImport,
  VideoPlaylistCreateResult,
  VideoPlaylistElementCreateResult,
  VideoPlaylistPrivacy,
  VideoPrivacy
} from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  waitJobs
} from '@peertube/peertube-server-commands'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { expect } from 'chai'

describe('Test channel activities', function () {
  let server: PeerTubeServer
  let editorToken: string
  let channelId: number
  let channelId2: number

  async function getActivityAfterAction (action: () => Promise<any>) {
    const before = new Date()
    await action()

    const { data } = await server.channels.listActivities({ channelName: 'eminem_channel', sort: '-createdAt' })

    const activity = data[0]

    expect(new Date(activity.createdAt).getTime()).to.be.greaterThan(before.getTime())

    if (data.length >= 2) {
      expect(new Date(data[1].createdAt).getTime()).to.be.below(before.getTime())
    }

    return data[0]
  }

  before(async function () {
    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultAccountAvatar([ server ])

    {
      const channel = await server.channels.create({ attributes: { name: 'eminem_channel', displayName: 'Eminem' } })
      channelId = channel.id
    }

    {
      const channel = await server.channels.create({ attributes: { name: 'mero', displayName: 'Mero' } })
      channelId2 = channel.id
    }

    editorToken = await server.channelCollaborators.createEditor('editor', 'eminem_channel')
  })

  describe('Channel', function () {
    it('Should have an empty activities list', async function () {
      const { data, total } = await server.channels.listActivities({ channelName: 'eminem_channel' })
      expect(data).to.have.lengthOf(0)
      expect(total).to.equal(0)
    })

    it('Should update a channel', async function () {
      const a = await getActivityAfterAction(() => {
        return server.channels.update({
          channelName: 'eminem_channel',

          attributes: {
            displayName: 'Updated Eminem',
            description: 'This is the new description'
          }
        })
      })

      expect(a.id).to.exist

      expect(a.account.id).to.exist
      expect(a.account.avatars).to.have.length.greaterThan(3)
      expect(a.account.displayName).to.equal('root')
      expect(a.account.host).to.exist
      expect(a.account.url).to.exist

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE)
      expect(a.action.label).to.equal('Update')

      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.CHANNEL)
      expect(a.targetType.label).to.equal('Channel')

      expect(a.channel.id).to.exist
      expect(a.channel.displayName).to.equal('Updated Eminem')
      expect(a.channel.name).to.equal('eminem_channel')
      expect(a.channel.url).to.exist

      expect(a.details).to.be.null
    })

    it('Should update channel avatar', async function () {
      const a = await getActivityAfterAction(() => {
        return server.channels.updateImage({
          channelName: 'eminem_channel',
          type: 'avatar'
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.CHANNEL)
      expect(a.channel.name).to.equal('eminem_channel')
    })

    it('Should update channel banner', async function () {
      const a = await getActivityAfterAction(() => {
        return server.channels.updateImage({
          channelName: 'eminem_channel',
          type: 'banner'
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.CHANNEL)
      expect(a.channel.name).to.equal('eminem_channel')
    })

    it('Should delete channel avatar by editor', async function () {
      const a = await getActivityAfterAction(() => {
        return server.channels.deleteImage({
          token: editorToken,
          channelName: 'eminem_channel',
          type: 'avatar'
        })
      })

      expect(a.account.displayName).to.equal('editor')
      expect(a.account.avatars).to.have.lengthOf(0)

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.CHANNEL)
      expect(a.channel.name).to.equal('eminem_channel')
    })

    it('Should delete channel banner', async function () {
      const a = await getActivityAfterAction(() => {
        return server.channels.deleteImage({
          channelName: 'eminem_channel',
          type: 'avatar'
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.CHANNEL)
      expect(a.channel.name).to.equal('eminem_channel')
    })

    it('Should update player settings', async function () {
      const a = await getActivityAfterAction(() => {
        return server.playerSettings.updateForChannel({
          channelHandle: 'eminem_channel',
          theme: 'lucide'
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.CHANNEL)
    })
  })

  describe('Videos', function () {
    let video: VideoCreateResult

    before(async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          videoFile: {
            update: {
              enabled: true
            }
          }
        }
      })

      await server.config.enableMinimumTranscoding()
    })

    it('Should upload a video', async function () {
      const a = await getActivityAfterAction(async () => {
        video = await server.videos.quickUpload({
          name: 'uploaded video',
          channelId
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.CREATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)

      expect(a.video.id).to.exist
      expect(a.video.name).to.equal('uploaded video')
      expect(a.video.uuid).to.exist
      expect(a.video.shortUUID).to.exist
      expect(a.video.url).to.exist
      expect(a.video.isLive).to.be.false
    })

    it('Should update the video', async function () {
      const a = await getActivityAfterAction(() => {
        return server.videos.update({
          id: video.id,
          attributes: {
            name: 'Updated video name'
          }
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
      expect(a.video.name).to.equal('Updated video name')
    })

    it('Should add captions', async function () {
      const a = await getActivityAfterAction(async () => {
        await server.captions.add({
          videoId: video.id,
          language: 'fr'
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE_CAPTIONS)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
    })

    it('Should remove captions by editor', async function () {
      const a = await getActivityAfterAction(async () => {
        await server.captions.delete({ videoId: video.id, language: 'fr', token: editorToken })
      })

      expect(a.account.name).to.equal('editor')
      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE_CAPTIONS)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
    })

    it('Should add a password', async function () {
      await server.videos.update({
        id: video.id,
        attributes: { privacy: VideoPrivacy.PASSWORD_PROTECTED, videoPasswords: [ 'password 1' ] }
      })

      const a = await getActivityAfterAction(async () => {
        await server.videoPasswords.updateAll({
          videoId: video.id,
          passwords: [ 'mypassword1', 'mypassword2' ]
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE_PASSWORDS)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
    })

    it('Should delete a password', async function () {
      const { data } = await server.videoPasswords.list({ videoId: video.id })

      const a = await getActivityAfterAction(async () => {
        await server.videoPasswords.remove({ id: data[0].id, videoId: video.id, token: editorToken })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE_PASSWORDS)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)

      await server.videos.update({ id: video.id, attributes: { privacy: VideoPrivacy.PUBLIC } })
    })

    it('Should add chapters', async function () {
      const a = await getActivityAfterAction(async () => {
        await server.chapters.update({
          videoId: video.id,

          chapters: [
            { timecode: 0, title: 'Intro' }
          ]
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE_CHAPTERS)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
    })

    it('Should add a source file', async function () {
      this.timeout(60000)

      const video = await server.videos.quickUpload({ name: 'video with source file', channelId })
      await waitJobs([ server ])

      const a = await getActivityAfterAction(async () => {
        await server.videos.replaceSourceFile({
          token: editorToken,
          videoId: video.id,
          fixture: 'video_short.mp4'
        })
      })

      await waitJobs([ server ])

      expect(a.account.name).to.equal('editor')
      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE_SOURCE_FILE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
    })

    it('Should delete a source file', async function () {
      const a = await getActivityAfterAction(async () => {
        await server.videos.deleteSource({ id: video.id })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE_SOURCE_FILE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
    })

    it('Should create a studio task', async function () {
      this.timeout(60000)

      await server.config.enableStudio()

      const video = await server.videos.quickUpload({ name: 'video for studio', channelId })
      await waitJobs([ server ])

      const a = await getActivityAfterAction(async () => {
        await server.videoStudio.createEditionTasks({
          videoId: video.id,
          token: editorToken,
          tasks: [
            {
              name: 'cut',
              options: {
                start: 1,
                end: 3
              }
            }
          ]
        })
      })

      expect(a.account.name).to.equal('editor')
      expect(a.action.id).to.equal(VideoChannelActivityAction.CREATE_STUDIO_TASKS)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
    })

    it('Should delete the video', async function () {
      const a = await getActivityAfterAction(() => {
        return server.videos.remove({ id: video.id })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.DELETE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)

      expect(a.video.id).to.exist
      expect(a.video.name).to.equal('Updated video name')
      expect(a.video.uuid).to.exist
      expect(a.video.shortUUID).to.exist
      expect(a.video.url).to.exist
      expect(a.video.isLive).to.be.false
    })

    it('Should update the channel of a video', async function () {
      const video = await server.videos.quickUpload({ name: 'video to change channel', channelId })

      {
        const a = await getActivityAfterAction(() => {
          return server.videos.update({ id: video.id, attributes: { channelId: channelId2 } })
        })

        expect(a.action.id).to.equal(VideoChannelActivityAction.REMOVE_CHANNEL_OWNERSHIP)
        expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
        expect(a.video.name).to.equal('video to change channel')
      }

      {
        const { data } = await server.channels.listActivities({ channelName: 'mero', sort: '-createdAt' })
        const a2 = data[0]

        expect(a2.action.id).to.equal(VideoChannelActivityAction.CREATE_CHANNEL_OWNERSHIP)
        expect(a2.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
        expect(a2.video.name).to.equal('video to change channel')
      }
    })
  })

  describe('Lives', async function () {
    let liveVideo: VideoCreateResult

    before(async function () {
      await server.config.enableLive()
    })

    it('Should create a live', async function () {
      const a = await getActivityAfterAction(async () => {
        liveVideo = await server.live.create({
          fields: {
            name: 'live',
            privacy: VideoPrivacy.PUBLIC,
            channelId
          }
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.CREATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
      expect(a.video.id).to.exist
      expect(a.video.name).to.equal('live')
      expect(a.video.uuid).to.exist
      expect(a.video.shortUUID).to.exist
      expect(a.video.url).to.exist
      expect(a.video.isLive).to.be.true
    })

    it('Should update the live', async function () {
      const a = await getActivityAfterAction(() => {
        return server.live.update({
          videoId: liveVideo.id,
          fields: {
            latencyMode: LiveVideoLatencyMode.HIGH_LATENCY
          }
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
    })

    it('Should delete the live', async function () {
      const a = await getActivityAfterAction(() => {
        return server.videos.remove({ id: liveVideo.id })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.DELETE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
      expect(a.video.name).to.equal('live')
      expect(a.video.isLive).to.be.true
    })
  })

  describe('Video imports', function () {
    let videoImport: VideoImport

    it('Should import a video', async function () {
      const a = await getActivityAfterAction(async () => {
        videoImport = await server.videoImports.importVideo({ attributes: { targetUrl: FIXTURE_URLS.goodVideo, channelId } })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.CREATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO_IMPORT)

      expect(a.videoImport.id).to.exist
      expect(a.videoImport.name).to.equal('good_video')
      expect(a.videoImport.targetUrl).to.equal(FIXTURE_URLS.goodVideo)
      expect(a.videoImport.uuid).to.exist
      expect(a.videoImport.shortUUID).to.exist
      expect(a.videoImport.url).to.exist
    })

    it('Should delete the import video', async function () {
      const a = await getActivityAfterAction(() => {
        return server.videos.remove({ id: videoImport.video.id })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.DELETE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)

      const { data } = await server.channels.listActivities({ channelName: 'eminem_channel', sort: '-createdAt' })
      const importRow = data[1]

      expect(importRow.videoImport.id).to.exist
      expect(importRow.videoImport.name).to.equal('good_video')
      expect(importRow.videoImport.targetUrl).to.equal(FIXTURE_URLS.goodVideo)
      expect(importRow.videoImport.uuid).to.exist
      expect(importRow.videoImport.shortUUID).to.exist
      expect(importRow.videoImport.url).to.exist
    })
  })

  describe('Playlists', function () {
    let playlist: VideoPlaylistCreateResult
    let playlistElement: VideoPlaylistElementCreateResult

    it('Should create a playlist', async function () {
      const a = await getActivityAfterAction(async () => {
        playlist = await server.playlists.create({
          attributes: {
            displayName: 'My playlist',
            videoChannelId: channelId,
            privacy: VideoPlaylistPrivacy.PRIVATE
          }
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.CREATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.PLAYLIST)

      expect(a.playlist.id).to.exist
      expect(a.playlist.name).to.equal('My playlist')
      expect(a.playlist.uuid).exist
      expect(a.playlist.url).to.exist
    })

    it('Should update the playlist', async function () {
      const a = await getActivityAfterAction(() => {
        return server.playlists.update({
          playlistId: playlist.id,
          attributes: {
            displayName: 'My playlist updated',
            videoChannelId: channelId
          }
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.PLAYLIST)
      expect(a.playlist.name).to.equal('My playlist updated')
    })

    it('Should add elements in a playlist', async function () {
      const video = await server.videos.quickUpload({ name: 'playlist video 1', channelId })

      const a = await getActivityAfterAction(async () => {
        playlistElement = await server.playlists.addElement({
          playlistId: playlist.id,
          attributes: {
            videoId: video.id
          }
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE_ELEMENTS)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.PLAYLIST)
    })

    it('Should update elements in a playlist', async function () {
      const a = await getActivityAfterAction(() => {
        return server.playlists.updateElement({
          playlistId: playlist.id,
          elementId: playlistElement.id,
          attributes: {
            startTimestamp: 10
          }
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE_ELEMENTS)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.PLAYLIST)
    })

    it('Should delete elements in a playlist', async function () {
      const a = await getActivityAfterAction(async () => {
        await server.playlists.removeElement({
          playlistId: playlist.id,
          elementId: playlistElement.id
        })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.UPDATE_ELEMENTS)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.PLAYLIST)
    })

    it('Should delete the playlist', async function () {
      const a = await getActivityAfterAction(() => {
        return server.playlists.delete({ playlistId: playlist.id })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.DELETE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.PLAYLIST)
      expect(a.playlist.name).to.equal('My playlist updated')
    })

    it('Should assign a new channel to a playlist without channel', async function () {
      const playlist = await server.playlists.create({
        attributes: {
          displayName: 'With a new channel',
          privacy: VideoPlaylistPrivacy.PRIVATE
        }
      })

      const a = await getActivityAfterAction(() => {
        return server.playlists.update({ playlistId: playlist.id, attributes: { videoChannelId: channelId } })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.CREATE_CHANNEL_OWNERSHIP)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.PLAYLIST)
      expect(a.playlist.name).to.equal('With a new channel')
    })

    it('Should delete the channel of a playlist', async function () {
      const playlist = await server.playlists.create({
        attributes: {
          displayName: 'Playlist channel deleted',
          videoChannelId: channelId,
          privacy: VideoPlaylistPrivacy.UNLISTED
        }
      })

      const a = await getActivityAfterAction(() => {
        return server.playlists.update({ playlistId: playlist.id, attributes: { videoChannelId: 'null' as any } })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.REMOVE_CHANNEL_OWNERSHIP)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.PLAYLIST)
      expect(a.playlist.name).to.equal('Playlist channel deleted')
    })

    it('Should update the channel of a playlist', async function () {
      {
        const playlist = await server.playlists.create({
          attributes: {
            displayName: 'Playlist channel updated',
            videoChannelId: channelId,
            privacy: VideoPlaylistPrivacy.PUBLIC
          }
        })

        const a = await getActivityAfterAction(() => {
          return server.playlists.update({ playlistId: playlist.id, attributes: { videoChannelId: channelId2 } })
        })

        expect(a.action.id).to.equal(VideoChannelActivityAction.REMOVE_CHANNEL_OWNERSHIP)
        expect(a.targetType.id).to.equal(VideoChannelActivityTarget.PLAYLIST)
        expect(a.playlist.name).to.equal('Playlist channel updated')
      }

      {
        const { data } = await server.channels.listActivities({ channelName: 'mero', sort: '-createdAt' })
        const a2 = data[0]

        expect(a2.action.id).to.equal(VideoChannelActivityAction.CREATE_CHANNEL_OWNERSHIP)
        expect(a2.targetType.id).to.equal(VideoChannelActivityTarget.PLAYLIST)
        expect(a2.playlist.name).to.equal('Playlist channel updated')
      }
    })
  })

  describe('Channel sync', function () {
    let syncId: number

    before(async function () {
      await server.config.enableChannelSync()
    })

    it('Should create a channel sync', async function () {
      const a = await getActivityAfterAction(async () => {
        const { videoChannelSync } = await server.channelSyncs.create({
          attributes: {
            externalChannelUrl: FIXTURE_URLS.youtubePlaylist,
            videoChannelId: channelId
          }
        })

        syncId = videoChannelSync.id
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.CREATE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.CHANNEL_SYNC)

      expect(a.channelSync.id).to.exist
      expect(a.channelSync.externalChannelUrl).to.equal(FIXTURE_URLS.youtubePlaylist)
    })

    it('Should delete a channel sync', async function () {
      const a = await getActivityAfterAction(() => {
        return server.channelSyncs.delete({ channelSyncId: syncId })
      })

      expect(a.action.id).to.equal(VideoChannelActivityAction.DELETE)
      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.CHANNEL_SYNC)
      expect(a.channelSync.externalChannelUrl).to.equal(FIXTURE_URLS.youtubePlaylist)
    })
  })

  describe('Common', function () {
    let channelId: number

    before(async function () {
      await server.channels.create({ attributes: { name: 'soprano_channel', displayName: 'Soprano' } })

      await server.channels.update({
        channelName: 'soprano_channel',
        attributes: {
          description: 'This is the new description'
        }
      })

      channelId = await server.channels.getIdOf({ channelName: 'soprano_channel' })

      const { uuid } = await server.videos.quickUpload({
        name: 'Inaya',
        channelId
      })

      await server.videos.remove({ id: uuid })
    })

    it('Should correctly paginate activities', async function () {
      const { data, total } = await server.channels.listActivities({ channelName: 'soprano_channel', start: 1, count: 1 })

      expect(total).to.equal(3)

      expect(data).to.have.lengthOf(1)
      expect(data[0].targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
      expect(data[0].action.id).to.equal(VideoChannelActivityAction.CREATE)

      {
        const { data, total } = await server.channels.listActivities({ channelName: 'soprano_channel', start: 1, count: 2 })

        expect(total).to.equal(3)
        expect(data).to.have.lengthOf(2)
      }
    })

    it('Should correctly sort activities', async function () {
      {
        const { data, total } = await server.channels.listActivities({
          channelName: 'soprano_channel',
          sort: 'createdAt',
          start: 0,
          count: 1
        })
        expect(total).to.equal(3)

        expect(data).to.have.lengthOf(1)
        expect(data[0].targetType.id).to.equal(VideoChannelActivityTarget.CHANNEL)
        expect(data[0].action.id).to.equal(VideoChannelActivityAction.UPDATE)
      }

      {
        const { data, total } = await server.channels.listActivities({
          channelName: 'soprano_channel',
          sort: '-createdAt',
          start: 0,
          count: 1
        })

        expect(total).to.equal(3)

        expect(data).to.have.lengthOf(1)
        expect(data[0].targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
        expect(data[0].action.id).to.equal(VideoChannelActivityAction.DELETE)
      }
    })

    it('Should still display activities if the account is deleted', async function () {
      const editor2Token = await server.channelCollaborators.createEditor('editor2', 'soprano_channel')

      await server.videos.quickUpload({ name: 'deleted account', channelId, token: editor2Token })
      await server.users.deleteMe({ token: editor2Token })

      const { data } = await server.channels.listActivities({
        channelName: 'soprano_channel',
        sort: '-createdAt',
        start: 0,
        count: 1
      })

      expect(data).to.have.lengthOf(1)
      const a = data[0]

      expect(a.targetType.id).to.equal(VideoChannelActivityTarget.VIDEO)
      expect(a.action.id).to.equal(VideoChannelActivityAction.CREATE)

      expect(a.account).to.not.exist
      expect(a.video.name).to.equal('deleted account')
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
