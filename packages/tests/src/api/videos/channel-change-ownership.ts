/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { ChangeOwnershipState, HttpStatusCode, VideoPlaylistPrivacy, VideoPrivacy } from '@peertube/peertube-models'
import {
  ChangeOwnershipCommand,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test channel change ownership', function () {
  let servers: PeerTubeServer[] = []

  const firstUser = 'first'
  const secondUser = 'second'

  let firstUserToken = ''
  let secondUserToken = ''
  let unrelatedUserToken = ''

  let firstUserEditorToken = ''
  let secondUserEditorToken = ''

  let lastRequestId: number

  let videoId: string
  let playlistId: string
  let privatePlaylistId1: string
  let privatePlaylistId2: string

  let command: ChangeOwnershipCommand

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    firstUserToken = await servers[0].users.generateUserAndToken(firstUser)
    secondUserToken = await servers[0].users.generateUserAndToken(secondUser)
    unrelatedUserToken = await servers[0].users.generateUserAndToken('unrelated')

    const { id } = await servers[0].channels.create({ token: firstUserToken, attributes: { name: 'first_user_channel' } })

    {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video 1', channelId: id })
      videoId = uuid
    }

    {
      const { uuid } = await servers[0].playlists.quickCreate({
        token: firstUserToken,
        displayName: 'playlist',
        privacy: VideoPrivacy.PUBLIC,
        channelId: id
      })
      await servers[0].playlists.addElement({ playlistId: uuid, attributes: { videoId } })

      playlistId = uuid
    }

    {
      const { uuid } = await servers[0].playlists.quickCreate({
        token: firstUserToken,
        displayName: 'private playlist 1',
        privacy: VideoPrivacy.PRIVATE,
        channelId: id
      })
      await servers[0].playlists.addElement({ playlistId: uuid, attributes: { videoId } })

      privatePlaylistId1 = uuid
    }

    {
      const { uuid } = await servers[0].playlists.quickCreate({
        token: firstUserToken,
        displayName: 'private playlist 2',
        privacy: VideoPrivacy.PRIVATE
      })
      await servers[0].playlists.addElement({ playlistId: uuid, attributes: { videoId } })

      privatePlaylistId2 = uuid
    }

    firstUserEditorToken = await servers[0].channelCollaborators.createEditor('first_user_editor', 'first_user_channel')
    secondUserEditorToken = await servers[0].channelCollaborators.createEditor('second_user_editor', secondUser + '_channel')

    command = servers[0].changeOwnership

    await doubleFollow(servers[0], servers[1])
  })

  it('Should not have channel change ownership', async function () {
    for (const token of [ firstUserToken, secondUserToken, unrelatedUserToken ]) {
      const body = await command.listChannels({ token })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(0)
    }
  })

  it('Should send a request to change ownership of a channel', async function () {
    await command.createChannel({ token: firstUserToken, channelName: 'first_user_channel', username: secondUser })
  })

  it('Should correctly list ownership change', async function () {
    {
      const body = await command.listChannels({ token: unrelatedUserToken })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(0)
    }

    for (const token of [ firstUserToken, secondUserToken ]) {
      const body = await command.listChannels({ token })

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(1)

      const entry = body.data[0]

      expect(entry.createdAt).to.exist
      expect(entry.id).to.exist
      expect(entry.initiatorAccount.name).to.equal(firstUser)
      expect(entry.nextOwnerAccount.name).to.equal(secondUser)
      expect(entry.state.id).to.equal(ChangeOwnershipState.PENDING)
      expect(entry.videoChannel.name).to.equal('first_user_channel')
      expect(entry.videoChannel.avatars).to.be.an('array')

      lastRequestId = body.data[0].id
    }
  })

  it('Should not be possible to refuse the change of ownership from first user', async function () {
    await command.refuseChannel({ token: firstUserToken, ownershipId: lastRequestId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should be possible to refuse the change of ownership from second user', async function () {
    await command.refuseChannel({ token: secondUserToken, ownershipId: lastRequestId })
  })

  it('Should send a new request to change ownership of a channel', async function () {
    await command.createChannel({ token: firstUserToken, channelName: 'first_user_channel', username: secondUser })
  })

  it('Should return two requests to change ownership for the second user', async function () {
    {
      const body = await command.listChannels({ token: unrelatedUserToken })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(0)
    }

    for (const token of [ firstUserToken, secondUserToken ]) {
      const body = await command.listChannels({ token })

      expect(body.total).to.equal(2)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(2)

      lastRequestId = body.data[0].id
    }
  })

  it('Should correctly sort/paginate ownership change list', async function () {
    const body = await command.listChannels({ token: secondUserToken, start: 1, count: 1, sort: 'createdAt' })

    expect(body.total).to.equal(2)
    expect(body.data).to.be.an('array')
    expect(body.data.length).to.equal(1)

    const entry = body.data[0]
    expect(entry.state.id).to.equal(ChangeOwnershipState.PENDING)
  })

  it('Should not list change ownership requests for collaborators', async function () {
    const body = await command.listChannels({ token: firstUserEditorToken })

    expect(body.total).to.equal(0)
    expect(body.data).to.be.an('array')
    expect(body.data.length).to.equal(0)
  })

  it('Should not list change ownership requests for collaborators of a channel of next owner', async function () {
    const body = await command.listChannels({ token: secondUserEditorToken })

    expect(body.total).to.equal(0)
    expect(body.data).to.be.an('array')
    expect(body.data.length).to.equal(0)
  })

  it('Should not be possible to accept the change of ownership from first user', async function () {
    await command.acceptChannel({
      token: firstUserToken,
      ownershipId: lastRequestId,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should be possible to accept the change of ownership from second user', async function () {
    await command.acceptChannel({ token: secondUserToken, ownershipId: lastRequestId })

    await waitJobs(servers)
  })

  it('Should have the owner of the channel updated', async function () {
    for (const server of servers) {
      const video = await server.videos.get({ id: videoId })

      expect(video.name).to.equal('video 1')
      expect(video.channel.name).to.equal('first_user_channel')
      expect(video.account.name).to.equal(secondUser)

      const channel = await server.channels.get({ channelName: 'first_user_channel@' + servers[0].host })

      expect(channel.name).to.equal('first_user_channel')
      expect(channel.ownerAccount.name).to.equal(secondUser)

      const playlist = await server.playlists.get({ playlistId })

      expect(playlist.displayName).to.equal('playlist')
      expect(playlist.privacy.id).to.equal(VideoPlaylistPrivacy.PUBLIC)
      expect(playlist.videoChannel.name).to.equal('first_user_channel')
      expect(playlist.ownerAccount.name).to.equal(secondUser)
    }

    {
      const playlist = await servers[0].playlists.get({ playlistId: privatePlaylistId1, token: servers[0].accessToken })

      expect(playlist.displayName).to.equal('private playlist 1')
      expect(playlist.privacy.id).to.equal(VideoPlaylistPrivacy.PRIVATE)
      expect(playlist.videoChannel.name).to.equal('first_user_channel')
      expect(playlist.ownerAccount.name).to.equal(secondUser)
    }

    {
      const playlist = await servers[0].playlists.get({ playlistId: privatePlaylistId2, token: servers[0].accessToken })

      expect(playlist.displayName).to.equal('private playlist 2')
      expect(playlist.privacy.id).to.equal(VideoPlaylistPrivacy.PRIVATE)
      expect(playlist.videoChannel).to.not.exist
      expect(playlist.ownerAccount.name).to.equal(firstUser)
    }
  })

  it('Should have kept collaborators on this channel', async function () {
    const collaborators = await servers[0].channelCollaborators.list({ channel: 'first_user_channel' })

    expect(collaborators.total).to.equal(1)
    expect(collaborators.data).to.be.an('array')
    expect(collaborators.data.length).to.equal(1)

    expect(collaborators.data[0].account.name).to.equal('first_user_editor')
  })

  it('Should transfer ownership of the channel to a collaborator', async function () {
    await command.createChannel({ token: secondUserToken, channelName: 'first_user_channel', username: 'first_user_editor' })

    const body = await command.listChannels({ token: firstUserEditorToken })
    const ownershipChangeId = body.data[0].id

    await command.acceptChannel({ token: firstUserEditorToken, ownershipId: ownershipChangeId })

    await waitJobs(servers)

    const collaborators = await servers[0].channelCollaborators.list({ channel: 'first_user_channel' })
    expect(collaborators.total).to.equal(0)

    const channel = await servers[0].channels.get({ channelName: 'first_user_channel' })

    expect(channel.name).to.equal('first_user_channel')
    expect(channel.ownerAccount.name).to.equal('first_user_editor')
  })

  it('Should delete an ownership change request', async function () {
    await command.createChannel({ token: firstUserEditorToken, channelName: 'first_user_channel', username: firstUser })

    const { data } = await command.listOfChannel({ token: firstUserEditorToken, channelName: 'first_user_channel' })
    const ownershipChangeId = data[0].id

    await command.deleteChannel({ ownershipId: ownershipChangeId, token: firstUserEditorToken })

    const bodyAfterDelete = await command.listOfChannel({
      token: firstUserEditorToken,
      channelName: 'first_user_channel',
      state: ChangeOwnershipState.PENDING
    })
    expect(bodyAfterDelete.total).to.equal(0)
  })

  it('Should list ownership changes for a specific channel', async function () {
    const body = await command.listOfChannel({ channelName: 'first_user_channel' })

    expect(body.total).to.equal(3)
    expect(body.data).to.be.an('array')
    expect(body.data.length).to.equal(3)

    expect(body.data[0].videoChannel.name).to.equal('first_user_channel')

    expect(body.data.map(i => i.status)).to.have.members([ 'ACCEPTED', 'ACCEPTED', 'REFUSED' ])
    expect(body.data.map(i => i.state.label)).to.have.members([ 'Accepted', 'Accepted', 'Rejected' ])
    expect(body.data.map(i => i.state.id)).to.have.members([
      ChangeOwnershipState.ACCEPTED,
      ChangeOwnershipState.ACCEPTED,
      ChangeOwnershipState.REJECTED
    ])
  })

  it('Should list ownership changes with state filter', async function () {
    const body = await command.listOfChannel({
      channelName: 'first_user_channel',
      state: ChangeOwnershipState.ACCEPTED
    })

    expect(body.total).to.equal(2)

    for (const entry of body.data) {
      expect(entry.status).to.equal('ACCEPTED')
      expect(entry.state.id).to.equal(ChangeOwnershipState.ACCEPTED)
      expect(entry.state.label).to.equal('Accepted')
    }
  })

  it('Should not be possible to accept the change of ownership from second user because of exceeded quota', async function () {
    const outOfQuotaToken = await servers[0].users.generateUserAndToken('out_of_quota_user')
    const outOfQuotaId = (await servers[0].users.getMyInfo({ token: outOfQuotaToken })).id
    await servers[0].users.update({ userId: outOfQuotaId, videoQuota: 0 })

    await command.createChannel({ token: firstUserEditorToken, channelName: 'first_user_channel', username: 'out_of_quota_user' })

    const body = await servers[0].changeOwnership.listChannels({ token: outOfQuotaToken })
    lastRequestId = body.data[0].id

    await servers[0].changeOwnership.acceptChannel({
      token: outOfQuotaToken,
      ownershipId: lastRequestId,
      expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
