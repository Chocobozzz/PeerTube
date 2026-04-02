/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoChangeOwnershipStatus, VideoPrivacy } from '@peertube/peertube-models'
import {
  ChangeOwnershipCommand,
  cleanupTests,
  createMultipleServers,
  createSingleServer,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test video change ownership - nominal', function () {
  let servers: PeerTubeServer[] = []

  const firstUser = 'first'
  const secondUser = 'second'

  let firstUserToken = ''
  let firstUserChannelId: number

  let secondUserToken = ''
  let secondUserChannelId: number

  let unrelatedUserToken = ''

  let firstUserEditorToken = ''
  let secondUserEditorToken = ''

  let lastRequestId: number

  let liveId: number

  let command: ChangeOwnershipCommand

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await servers[0].config.updateExistingConfig({
      newConfig: {
        transcoding: {
          enabled: false
        },
        live: {
          enabled: true
        }
      }
    })

    firstUserToken = await servers[0].users.generateUserAndToken(firstUser)
    secondUserToken = await servers[0].users.generateUserAndToken(secondUser)
    unrelatedUserToken = await servers[0].users.generateUserAndToken('unrelated')

    firstUserEditorToken = await servers[0].channelCollaborators.createEditor('first_user_editor', firstUser + '_channel')
    secondUserEditorToken = await servers[0].channelCollaborators.createEditor('second_user_editor', secondUser + '_channel')

    {
      const { videoChannels } = await servers[0].users.getMyInfo({ token: firstUserToken })
      firstUserChannelId = videoChannels[0].id
    }

    {
      const { videoChannels } = await servers[0].users.getMyInfo({ token: secondUserToken })
      secondUserChannelId = videoChannels[0].id
    }

    {
      const attributes = {
        name: 'my super name',
        description: 'my super description'
      }
      const { id } = await servers[0].videos.upload({ token: firstUserToken, attributes })

      servers[0].store.videoCreated = await servers[0].videos.get({ id })
    }

    {
      const attributes = { name: 'live', channelId: firstUserChannelId, privacy: VideoPrivacy.PUBLIC }
      const video = await servers[0].live.create({ token: firstUserToken, fields: attributes })

      liveId = video.id
    }

    command = servers[0].changeOwnership

    await doubleFollow(servers[0], servers[1])
  })

  it('Should not have video change ownership', async function () {
    for (const token of [ firstUserToken, secondUserToken, unrelatedUserToken ]) {
      const body = await command.list({ token })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(0)
    }
  })

  it('Should send a request to change ownership of a video', async function () {
    await command.create({ token: firstUserToken, videoId: servers[0].store.videoCreated.id, username: secondUser })
  })

  it('Should correctly list ownership change', async function () {
    {
      const body = await command.list({ token: unrelatedUserToken })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(0)
    }

    for (const token of [ firstUserToken, secondUserToken ]) {
      const body = await command.list({ token })

      expect(body.total).to.equal(1)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(1)

      lastRequestId = body.data[0].id
    }
  })

  it('Should not be possible to refuse the change of ownership from first user', async function () {
    await command.refuse({ token: firstUserToken, ownershipId: lastRequestId, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should be possible to refuse the change of ownership from second user', async function () {
    await command.refuse({ token: secondUserToken, ownershipId: lastRequestId })
  })

  it('Should send a new request to change ownership of a video', async function () {
    await command.create({ token: firstUserToken, videoId: servers[0].store.videoCreated.id, username: secondUser })
  })

  it('Should return two requests to change ownership for the second user', async function () {
    {
      const body = await command.list({ token: unrelatedUserToken })

      expect(body.total).to.equal(0)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(0)
    }

    for (const token of [ firstUserToken, secondUserToken ]) {
      const body = await command.list({ token })

      expect(body.total).to.equal(2)
      expect(body.data).to.be.an('array')
      expect(body.data.length).to.equal(2)

      lastRequestId = body.data[0].id
    }
  })

  it('Should list change ownership requests for collaborators', async function () {
    const body = await command.list({ token: firstUserEditorToken })

    expect(body.total).to.equal(2)
    expect(body.data).to.be.an('array')
    expect(body.data.length).to.equal(2)
  })

  it('Should list change ownership requests for collaborators of a channel of next owner', async function () {
    const body = await command.list({ token: secondUserEditorToken })

    expect(body.total).to.equal(0)
    expect(body.data).to.be.an('array')
    expect(body.data.length).to.equal(0)
  })

  it('Should not be possible to accept the change of ownership from first user', async function () {
    await command.accept({
      token: firstUserToken,
      ownershipId: lastRequestId,
      channelId: secondUserChannelId,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should be possible to accept the change of ownership from second user', async function () {
    await command.accept({ token: secondUserToken, ownershipId: lastRequestId, channelId: secondUserChannelId })

    await waitJobs(servers)
  })

  it('Should have the channel of the video updated', async function () {
    for (const server of servers) {
      const video = await server.videos.get({ id: servers[0].store.videoCreated.uuid })

      expect(video.name).to.equal('my super name')
      expect(video.channel.displayName).to.equal('Main second channel')
      expect(video.channel.name).to.equal('second_channel')
    }
  })

  it('Should send a request to change ownership of a live', async function () {
    await command.create({ token: firstUserToken, videoId: liveId, username: secondUser })

    const body = await command.list({ token: secondUserToken })

    expect(body.total).to.equal(3)
    expect(body.data.length).to.equal(3)

    lastRequestId = body.data[0].id
  })

  it('Should delete an ownership change request', async function () {
    const { data } = await command.listOfVideo({ videoId: liveId })
    const ownershipChangeId = data[0].id

    await command.delete({ ownershipId: ownershipChangeId, token: firstUserToken })

    const bodyAfterDelete = await command.listOfVideo({ videoId: liveId, state: VideoChangeOwnershipStatus.WAITING })
    expect(bodyAfterDelete.total).to.equal(0)
  })

  it('Should accept a live ownership change', async function () {
    await command.create({ token: firstUserToken, videoId: liveId, username: secondUser })
    const body = await command.list({ token: secondUserToken })
    lastRequestId = body.data[0].id

    await command.accept({ token: secondUserToken, ownershipId: lastRequestId, channelId: secondUserChannelId })

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: servers[0].store.videoCreated.uuid })

      expect(video.name).to.equal('my super name')
      expect(video.channel.displayName).to.equal('Main second channel')
      expect(video.channel.name).to.equal('second_channel')
    }
  })

  it('Should list ownership changes for a specific video', async function () {
    const body = await command.listOfVideo({ videoId: servers[0].store.videoCreated.id })

    expect(body.total).to.equal(2)
    expect(body.data).to.be.an('array')
    expect(body.data.length).to.equal(2)
    expect(body.data[0].video.id).to.equal(servers[0].store.videoCreated.id)

    expect(body.data.map(i => i.status)).to.have.members([ 'ACCEPTED', 'REFUSED' ])
  })

  it('Should list ownership changes with state filter', async function () {
    const body = await command.listOfVideo({
      videoId: servers[0].store.videoCreated.id,
      state: 'ACCEPTED'
    })

    expect(body.total).to.equal(1)

    expect(body.data[0].status).to.equal('ACCEPTED')
  })

  after(async function () {
    await cleanupTests(servers)
  })
})

describe('Test video change ownership - quota too small', function () {
  let server: PeerTubeServer
  const firstUser = 'first'
  const secondUser = 'second'

  let firstUserToken = ''
  let secondUserToken = ''
  let lastRequestId: number

  before(async function () {
    this.timeout(50000)

    // Run one server
    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    await server.users.create({ username: secondUser, videoQuota: 10 })

    firstUserToken = await server.users.generateUserAndToken(firstUser)
    secondUserToken = await server.login.getAccessToken(secondUser)

    // Upload some videos on the server
    const attributes = {
      name: 'my super name',
      description: 'my super description'
    }
    await server.videos.upload({ token: firstUserToken, attributes })

    await waitJobs(server)

    const { data } = await server.videos.list()
    expect(data.length).to.equal(1)

    server.store.videoCreated = data.find(video => video.name === 'my super name')
  })

  it('Should send a request to change ownership of a video', async function () {
    await server.changeOwnership.create({ token: firstUserToken, videoId: server.store.videoCreated.id, username: secondUser })
  })

  it('Should not be possible to accept the change of ownership from second user because of exceeded quota', async function () {
    const body = await server.changeOwnership.list({ token: secondUserToken })
    lastRequestId = body.data[0].id

    const { videoChannels } = await server.users.getMyInfo({ token: secondUserToken })
    const channelId = videoChannels[0].id

    await server.changeOwnership.accept({
      token: secondUserToken,
      ownershipId: lastRequestId,
      channelId,
      expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
