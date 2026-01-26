/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { BulkRemoveCommentsOfBody, HttpStatusCode, VideoChannelCollaboratorState, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkActorImage } from '@tests/shared/actors.js'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { expect } from 'chai'

describe('Test channel collaborators', function () {
  let servers: PeerTubeServer[]

  let collaborator1: string
  let collaborator2: string

  let collaboratorId1: number
  let collaboratorId2: number

  let channelCollabId: number
  let channelCollabId2: number

  async function expectMyChannels (token: string, owned: string[], collab: string[]) {
    const me = await servers[0].users.getMyInfo({ token })

    {
      expect(me.videoChannels.map(c => c.name)).to.have.members(owned)
      expect(me.videoChannelCollaborations.map(c => c.name)).to.have.members(collab)

      for (const c of [ ...me.videoChannels, ...me.videoChannelCollaborations ]) {
        expect(c).to.have.property('displayName')

        expect(c).to.have.property('description')
        expect(c).to.have.property('support')
        expect(c).to.have.property('isLocal')

        expect(c).to.have.property('updatedAt')

        expect(c).to.have.property('banners')
        expect(c).to.have.property('id')
        expect(c).to.have.property('url')
        expect(c).to.have.property('name')
        expect(c).to.have.property('host')
        expect(c).to.have.property('followingCount')
        expect(c).to.have.property('followersCount')
        expect(c).to.have.property('createdAt')
        expect(c).to.have.property('avatars')
        expect(c).to.have.property('ownerAccountId')
      }
    }

    {
      const names = [ ...owned, ...collab ]

      const { total, data } = await servers[0].channels.listByAccount({ accountName: me.username, token, includeCollaborations: true })
      expect(total).to.equal(names.length)
      expect(data).to.have.lengthOf(names.length)

      expect(data.map(c => c.name)).to.have.members(names)
    }

    {
      const { total, data } = await servers[0].channels.listByAccount({ accountName: me.username, token, includeCollaborations: false })
      expect(total).to.equal(owned.length)
      expect(data).to.have.lengthOf(owned.length)

      expect(data.map(c => c.name)).to.have.members(owned)
    }
  }

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await waitJobs(servers)

    collaborator1 = await servers[0].users.generateUserAndToken('collaborator1')
    collaborator2 = await servers[0].users.generateUserAndToken('collaborator2')

    await servers[0].users.updateMyAvatar({ fixture: 'avatar.png', token: collaborator1 })

    await waitJobs(servers)
  })

  describe('Manage collaborators', function () {
    it('Should not have collaborators by default', async function () {
      const collaborators = await servers[0].channelCollaborators.list({ channel: 'root_channel' })
      expect(collaborators.total).to.equal(0)
      expect(collaborators.data).to.have.lengthOf(0)
    })

    it('Should create a channel and invite a collaborator', async function () {
      const channel = await servers[0].channels.create({ attributes: { name: 'channel_collaboration1' } })
      channelCollabId = channel.id

      await servers[0].channels.updateImage({ channelName: 'channel_collaboration1', fixture: 'avatar.png', type: 'avatar' })

      const { id } = await servers[0].channelCollaborators.invite({ channel: 'channel_collaboration1', target: 'collaborator1' })
      collaboratorId1 = id

      const { total, data } = await servers[0].channelCollaborators.list({ channel: 'channel_collaboration1' })
      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      const collab = data[0]
      expect(collab.id).to.exist
      expect(collab.createdAt).to.exist
      expect(collab.updatedAt).to.exist
      expect(collab.state.id).to.equal(VideoChannelCollaboratorState.PENDING)
      expect(collab.state.label).to.equal('Pending')

      expect(collab.account.displayName).to.equal('collaborator1')
      expect(collab.account.host).to.equal(servers[0].host)
      expect(collab.account.id).to.exist
      expect(collab.account.name).to.equal('collaborator1')

      await checkActorImage(collab.account)
    })

    it('Should invite another collaborator', async function () {
      const { id } = await servers[0].channelCollaborators.invite({ channel: 'channel_collaboration1', target: 'collaborator2' })
      collaboratorId2 = id

      const { total, data } = await servers[0].channelCollaborators.list({ channel: 'channel_collaboration1' })
      expect(total).to.equal(2)
      expect(data).to.have.lengthOf(2)

      expect(data[0].account.name).to.equal('collaborator2')
      expect(data[1].account.name).to.equal('collaborator1')
    })

    it('Should not list channels when collaboration is not yet accepted', async function () {
      await expectMyChannels(servers[0].accessToken, [ 'root_channel', 'channel_collaboration1' ], [])
      await expectMyChannels(collaborator1, [ 'collaborator1_channel' ], [])
      await expectMyChannels(collaborator2, [ 'collaborator2_channel' ], [])
    })

    it('Should accept an invitation', async function () {
      await servers[0].channelCollaborators.accept({ channel: 'channel_collaboration1', id: collaboratorId1, token: collaborator1 })

      const { total, data } = await servers[0].channelCollaborators.list({ channel: 'channel_collaboration1', token: collaborator1 })
      expect(total).to.equal(2)
      expect(data).to.have.lengthOf(2)

      expect(data[0].account.name).to.equal('collaborator2')
      expect(data[0].state.id).to.equal(VideoChannelCollaboratorState.PENDING)
      expect(data[1].account.name).to.equal('collaborator1')
      expect(data[1].state.id).to.equal(VideoChannelCollaboratorState.ACCEPTED)
      expect(data[1].state.label).to.equal('Accepted')
    })

    it('Should list channel collaborations after having accepted an invitation', async function () {
      await expectMyChannels(servers[0].accessToken, [ 'root_channel', 'channel_collaboration1' ], [])
      await expectMyChannels(collaborator1, [ 'collaborator1_channel' ], [ 'channel_collaboration1' ])
      await expectMyChannels(collaborator2, [ 'collaborator2_channel' ], [])
    })

    it('Should reject an invitation', async function () {
      await servers[0].channelCollaborators.reject({ channel: 'channel_collaboration1', id: collaboratorId2, token: collaborator2 })

      const { total, data } = await servers[0].channelCollaborators.list({ channel: 'channel_collaboration1' })
      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      expect(data[0].account.name).to.equal('collaborator1')
      expect(data[0].state.id).to.equal(VideoChannelCollaboratorState.ACCEPTED)
    })

    it('Should be able to re-invite a rejected collaborator', async function () {
      const { id } = await servers[0].channelCollaborators.invite({ channel: 'channel_collaboration1', target: 'collaborator2' })
      collaboratorId2 = id

      {
        const { total, data } = await servers[0].channelCollaborators.list({ channel: 'channel_collaboration1' })
        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)
      }

      await servers[0].channelCollaborators.reject({ channel: 'channel_collaboration1', id: collaboratorId2, token: collaborator2 })

      {
        const { total, data } = await servers[0].channelCollaborators.list({ channel: 'channel_collaboration1' })
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      }
    })

    it('Should list channel collaborations after having rejected an invitation', async function () {
      await expectMyChannels(servers[0].accessToken, [ 'root_channel', 'channel_collaboration1' ], [])
      await expectMyChannels(collaborator1, [ 'collaborator1_channel' ], [ 'channel_collaboration1' ])
      await expectMyChannels(collaborator2, [ 'collaborator2_channel' ], [])
    })

    it('Should delete a pending invitation', async function () {
      const { id } = await servers[0].channelCollaborators.invite({ channel: 'channel_collaboration1', target: 'collaborator2' })
      collaboratorId2 = id

      {
        const { total, data } = await servers[0].channelCollaborators.list({ channel: 'channel_collaboration1' })
        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)
      }

      await servers[0].channelCollaborators.remove({ channel: 'channel_collaboration1', id: collaboratorId2 })

      {
        const { total, data } = await servers[0].channelCollaborators.list({ channel: 'channel_collaboration1' })
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      }

      await servers[0].channelCollaborators.accept({
        channel: 'channel_collaboration1',
        id: collaboratorId2,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should delete an accepted invitation', async function () {
      await servers[0].channelCollaborators.remove({ channel: 'channel_collaboration1', id: collaboratorId1 })

      const { total, data } = await servers[0].channelCollaborators.list({ channel: 'channel_collaboration1' })
      expect(total).to.equal(0)
      expect(data).to.have.lengthOf(0)
    })

    it('Should not list collab channels anymore', async function () {
      await expectMyChannels(servers[0].accessToken, [ 'root_channel', 'channel_collaboration1' ], [])
      await expectMyChannels(collaborator1, [ 'collaborator1_channel' ], [])
      await expectMyChannels(collaborator2, [ 'collaborator2_channel' ], [])
    })
  })

  describe('With a collaborator', function () {
    let user1: string
    let external: string
    let videoId: string
    let playlistId: string

    before(async function () {
      user1 = await servers[0].users.generateUserAndToken('user1')
      external = await servers[0].users.generateUserAndToken('external')

      {
        const { id } = await servers[0].channelCollaborators.invite({ channel: 'channel_collaboration1', target: 'collaborator1' })
        await servers[0].channelCollaborators.accept({ channel: 'channel_collaboration1', id, token: collaborator1 })
      }

      {
        const { id } = await servers[0].channelCollaborators.invite({ channel: 'channel_collaboration1', target: 'collaborator2' })
        await servers[0].channelCollaborators.accept({ channel: 'channel_collaboration1', id, token: collaborator2 })
      }

      {
        const { id } = await servers[0].channelCollaborators.invite({ channel: 'user1_channel', target: 'collaborator1', token: user1 })
        await servers[0].channelCollaborators.accept({ channel: 'user1_channel', id, token: collaborator1 })
      }
    })

    describe('Listing entities', function () {
      it('Should list videos from collab channels', async function () {
        const { uuid } = await servers[0].videos.upload({
          attributes: { name: 'video collab 1', channelId: channelCollabId },
          token: collaborator1
        })
        videoId = uuid

        await servers[0].videos.quickUpload({ name: 'video collab 2', channelId: channelCollabId, privacy: VideoPrivacy.PRIVATE })

        for (const token of [ collaborator1, collaborator2 ]) {
          {
            const videos = await servers[0].videos.listMyVideos({ token, includeCollaborations: true })

            expect(videos.total).to.equal(2)
            expect(videos.data).to.have.lengthOf(2)
            expect(videos.data[0].name).to.equal('video collab 2')
            expect(videos.data[1].name).to.equal('video collab 1')
          }

          {
            const videos = await servers[0].videos.listMyVideos({ token, includeCollaborations: false })

            expect(videos.total).to.equal(0)
            expect(videos.data).to.have.lengthOf(0)
          }
        }

        for (const token of [ external, user1 ]) {
          const videos = await servers[0].videos.listMyVideos({ token, includeCollaborations: true })
          expect(videos.total).to.equal(0)
          expect(videos.data).to.have.lengthOf(0)
        }
      })

      it('Should list comments from collab channels', async function () {
        await servers[0].comments.createThread({ token: external, videoId, text: 'A thread from collab channel' })
        await servers[0].comments.addReplyToLastThread({ token: external, text: 'A reply from collab channel' })

        for (const token of [ collaborator1, collaborator2 ]) {
          for (
            const comments of [
              await servers[0].comments.listCommentsOnMyVideos({ token, includeCollaborations: true, videoChannelId: channelCollabId }),
              await servers[0].comments.listCommentsOnMyVideos({ token, includeCollaborations: true, videoChannelId: channelCollabId })
            ]
          ) {
            expect(comments.total).to.equal(2)
            expect(comments.data).to.have.lengthOf(2)
            expect(comments.data[0].text).to.equal('A reply from collab channel')
            expect(comments.data[1].text).to.equal('A thread from collab channel')
          }

          const { total, data } = await servers[0].comments.listCommentsOnMyVideos({
            token,
            includeCollaborations: false,
            videoChannelId: channelCollabId
          })
          expect(total).to.equal(0)
          expect(data).to.have.lengthOf(0)
        }

        for (const token of [ external, user1 ]) {
          const comments = await servers[0].comments.listCommentsOnMyVideos({ token, includeCollaborations: true })
          expect(comments.total).to.equal(0)
          expect(comments.data).to.have.lengthOf(0)
        }
      })

      it('Should list playlists from collab channels', async function () {
        for (const displayName of [ 'playlist1', 'playlist2' ]) {
          const playlist = await servers[0].playlists.create({
            token: collaborator1,
            attributes: { displayName, privacy: VideoPrivacy.PUBLIC, videoChannelId: channelCollabId }
          })
          playlistId = playlist.uuid
        }

        await servers[0].playlists.addElement({ playlistId, attributes: { videoId }, token: collaborator2 })

        for (const token of [ collaborator1, collaborator2, servers[0].accessToken ]) {
          const me = await servers[0].users.getMyInfo({ token })

          {
            const playlists = await servers[0].playlists.listByAccount({ token, handle: me.username, includeCollaborations: true })
            expect(playlists.total).to.equal(3)
            expect(playlists.data).to.have.lengthOf(3)
            expect(playlists.data[0].displayName).to.equal('playlist2')
            expect(playlists.data[1].displayName).to.equal('playlist1')
            expect(playlists.data[2].displayName).to.equal('Watch later')
          }
        }

        // Filter out collaborated channels
        {
          const playlists = await servers[0].playlists.listByAccount({
            token: collaborator2,
            handle: 'collaborator2',
            includeCollaborations: false
          })
          expect(playlists.data.map(p => p.displayName)).to.have.members([ 'Watch later' ])
        }

        for (const token of [ external, user1 ]) {
          const me = await servers[0].users.getMyInfo({ token })

          const playlists = await servers[0].playlists.listByAccount({ token, handle: me.username, includeCollaborations: true })
          expect(playlists.total).to.equal(1)
          expect(playlists.data).to.have.lengthOf(1)
          expect(playlists.data[0].displayName).to.equal('Watch later')
        }
      })

      it('Should list imports from collab channels', async function () {
        const { video: rootVideo } = await servers[0].videoImports.quickImport({
          name: 'root import',
          targetUrl: FIXTURE_URLS.goodVideo,
          channelId: channelCollabId
        })

        const { video: collabVideo } = await servers[0].videoImports.quickImport({
          name: 'collab import',
          targetUrl: FIXTURE_URLS.goodVideo,
          token: collaborator1,
          channelId: channelCollabId
        })

        await waitJobs(servers)

        for (const token of [ servers[0].accessToken, collaborator1 ]) {
          const { total, data } = await servers[0].videoImports.listMyVideoImports({ token, includeCollaborations: true })
          expect(total).to.equal(2)
          expect(data).to.have.lengthOf(2)
          expect(data.map(i => i.video.name)).to.have.members([ 'root import', 'collab import' ])
        }

        // Filter out collaborated channels
        const { total, data } = await servers[0].videoImports.listMyVideoImports({ token: collaborator1, includeCollaborations: false })
        expect(total).to.equal(1)
        expect(data.map(i => i.video.name)).to.have.members([ 'collab import' ])

        // We delete the root video
        await servers[0].videos.remove({ id: rootVideo.id, token: collaborator1 })

        // Root still sees its import but collab doesn't see it anymore
        {
          const { data } = await servers[0].videoImports.listMyVideoImports({ token: collaborator1, includeCollaborations: true })
          expect(data.map(i => i.video.name)).to.have.members([ 'collab import' ])
        }

        {
          const { data } = await servers[0].videoImports.listMyVideoImports({ token: servers[0].accessToken, includeCollaborations: true })
          expect(data.map(i => i.video?.name)).to.have.members([ undefined, 'collab import' ])
        }

        // We delete the editor
        await servers[0].videos.remove({ id: collabVideo.id })

        // Collab still sees its import but root doesn't see it anymore
        {
          const { data } = await servers[0].videoImports.listMyVideoImports({ token: collaborator1, includeCollaborations: true })
          expect(data.map(i => i.video?.name)).to.have.members([ undefined ])
        }

        {
          const { data } = await servers[0].videoImports.listMyVideoImports({ token: servers[0].accessToken, includeCollaborations: true })
          expect(data.map(i => i.video?.name)).to.have.members([ undefined ])
        }
      })

      it('Should list syncs from collab channels', async function () {
        await servers[0].config.enableChannelSync()

        await servers[0].channelSyncs.create({
          attributes: {
            externalChannelUrl: FIXTURE_URLS.youtubeChannel,
            videoChannelId: channelCollabId
          },
          token: collaborator1
        })

        {
          const { data, total } = await servers[0].channelSyncs.listByAccount({
            accountName: 'collaborator1',
            token: collaborator1,
            includeCollaborations: false
          })
          expect(total).to.equal(0)
          expect(data).to.have.lengthOf(0)
        }

        {
          for (const token of [ collaborator1, collaborator2, servers[0].accessToken ]) {
            const me = await servers[0].users.getMyInfo({ token })

            const { data, total } = await servers[0].channelSyncs.listByAccount({
              accountName: me.username,
              token,
              includeCollaborations: true
            })
            expect(total).to.equal(1)
            expect(data).to.have.lengthOf(1)
          }
        }
      })
    })

    describe('Managing entities', function () {
      it('Should have federated objects created by collaborators', async function () {
        await waitJobs(servers)

        const video = await servers[1].videos.get({ id: videoId })
        expect(video.name).to.equal('video collab 1')

        const playlist = await servers[1].playlists.get({ playlistId })
        expect(playlist.displayName).to.equal('playlist2')
      })

      it('Should update the channel of a video', async function () {
        const channel = await servers[0].channels.create({ attributes: { name: 'channel_collaboration2' } })
        channelCollabId2 = channel.id

        const { id } = await servers[0].channelCollaborators.invite({ channel: 'channel_collaboration2', target: 'collaborator1' })
        await servers[0].channelCollaborators.accept({ channel: 'channel_collaboration2', id, token: collaborator1 })

        await servers[0].videos.update({ id: videoId, attributes: { channelId: channelCollabId2 }, token: collaborator1 })

        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: videoId })
          expect(video.channel.name).to.equal('channel_collaboration2')
        }
      })

      it('Should update the channel of a playlist', async function () {
        await servers[0].playlists.update({ playlistId, attributes: { videoChannelId: channelCollabId2 }, token: collaborator1 })

        await waitJobs(servers)

        for (const server of servers) {
          const playlist = await server.playlists.get({ playlistId })
          expect(playlist.videoChannel.name).to.equal('channel_collaboration2')
        }
      })

      it('Should bulk delete comments from collab channels', async function () {
        const channel = await servers[0].channels.create({ attributes: { name: 'channel_collaboration3' } })
        const editor = await servers[0].channelCollaborators.createEditor('comment_editor', 'channel_collaboration3')
        const { uuid } = await servers[0].videos.quickUpload({ name: 'video to comment', token: editor, channelId: channel.id })

        const commenter = await servers[0].users.generateUserAndToken('commenter')
        await servers[0].comments.createThread({ token: commenter, videoId: uuid, text: 'commenter' })

        const checkComments = async (total: number) => {
          const comments = await servers[0].comments.listCommentsOnMyVideos({
            token: editor,
            includeCollaborations: true,
            videoChannelId: channel.id
          })

          expect(comments.total).to.equal(total)
        }

        const deleteComments = async (accountName: string, scope: BulkRemoveCommentsOfBody['scope']) => {
          await servers[0].bulk.removeCommentsOf({
            token: editor,
            attributes: {
              accountName,
              scope
            }
          })

          await waitJobs(servers)
        }

        await checkComments(1)

        await deleteComments('commenter', 'my-videos')
        await checkComments(1)

        await deleteComments('root', 'my-videos-and-collaborations')
        await checkComments(1)

        await deleteComments('commenter', 'my-videos-and-collaborations')
        await checkComments(0)
      })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
