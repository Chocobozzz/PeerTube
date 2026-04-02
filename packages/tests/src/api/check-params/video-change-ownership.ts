/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoCreateResult } from '@peertube/peertube-models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test video change ownership API validator', function () {
  let server: PeerTubeServer
  let userToken: string
  let anotherUserToken: string
  let rootEditorToken: string
  let userEditorToken: string
  let ownershipChangeId: number

  let userVideo: VideoCreateResult
  let rootVideo: VideoCreateResult
  let rootVideo2: VideoCreateResult

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    userToken = await server.users.generateUserAndToken('user')
    anotherUserToken = await server.users.generateUserAndToken('another_user')
    rootEditorToken = await server.channelCollaborators.createEditor('root_editor', 'root_channel')
    userEditorToken = await server.channelCollaborators.createEditor('user_editor', 'user_channel')

    rootVideo = await server.videos.quickUpload({ name: 'root video' })
    rootVideo2 = await server.videos.quickUpload({ name: 'root video 2' })
    userVideo = await server.videos.quickUpload({ name: 'user video', token: userToken })
  })

  describe('Create video ownership change request', function () {
    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.create({
        videoId: userVideo.id,
        username: 'another_user',
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a video of another user', async function () {
      for (const token of [ userToken, userEditorToken ]) {
        await server.changeOwnership.create({
          videoId: rootVideo.id,
          username: 'another_user',
          token,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail with a non existing target', async function () {
      await server.changeOwnership.create({
        videoId: userVideo.id,
        username: 'unexisting',
        token: userToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a non existing video', async function () {
      await server.changeOwnership.create({
        videoId: 42,
        username: 'another_user',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.create({ videoId: rootVideo2.id, username: 'user', token: rootEditorToken })
      await server.changeOwnership.create({ videoId: rootVideo.id, username: 'user' })
    })

    it('Should fail to create a request for a video with a pending ownership change request', async function () {
      await server.changeOwnership.create({
        videoId: rootVideo2.id,
        username: 'user',
        token: rootEditorToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('List ownership change requests', function () {
    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.list({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should succeed with valid params', async function () {
      const { data } = await server.changeOwnership.list({ token: userToken })
      ownershipChangeId = data.find(d => d.video.id === rootVideo2.id).id
    })
  })

  describe('List video ownership changes', function () {
    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.listOfVideo({
        videoId: rootVideo.id,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing video', async function () {
      await server.changeOwnership.listOfVideo({
        videoId: 42,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a video of another user', async function () {
      for (const token of [ userToken, userEditorToken ]) {
        await server.changeOwnership.listOfVideo({
          videoId: rootVideo.id,
          token,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail with an invalid state parameter', async function () {
      await server.changeOwnership.listOfVideo({
        videoId: rootVideo.id,
        state: 'INVALID_STATE' as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with valid params', async function () {
      const { data, total } = await server.changeOwnership.listOfVideo({
        videoId: rootVideo.id
      })
      expect(total).to.be.a('number')
      expect(data).to.be.an('array')
    })

    it('Should succeed with a state filter', async function () {
      const { data } = await server.changeOwnership.listOfVideo({
        videoId: rootVideo.id,
        state: 'WAITING'
      })
      expect(data).to.be.an('array')
    })
  })

  describe('Reject ownership change request', function () {
    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.refuse({
        ownershipId: ownershipChangeId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing ownership id', async function () {
      await server.changeOwnership.refuse({ ownershipId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a ownership of another user', async function () {
      for (const token of [ userEditorToken, anotherUserToken, rootEditorToken ]) {
        await server.changeOwnership.refuse({
          ownershipId: ownershipChangeId,
          token,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.refuse({ ownershipId: ownershipChangeId, token: userToken })
    })

    it('Should fail to reject a non pending request', async function () {
      await server.changeOwnership.refuse({
        ownershipId: ownershipChangeId,
        token: userToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('Accept ownership change request', function () {
    let targetChannelId: number

    before(async function () {
      await server.changeOwnership.create({ videoId: rootVideo2.id, username: 'user' })

      const { data } = await server.changeOwnership.list({ token: userToken })
      ownershipChangeId = data[0].id

      const me = await server.users.getMyInfo({ token: userToken })
      targetChannelId = me.videoChannels[0].id
    })

    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.accept({
        ownershipId: ownershipChangeId,
        token: null,
        channelId: targetChannelId,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing ownership id', async function () {
      await server.changeOwnership.accept({
        ownershipId: 42,
        token: userToken,
        channelId: targetChannelId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a ownership of another user', async function () {
      for (const token of [ userEditorToken, anotherUserToken ]) {
        await server.changeOwnership.accept({
          ownershipId: ownershipChangeId,
          token,
          channelId: targetChannelId,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail with a non existing target', async function () {
      await server.changeOwnership.accept({
        ownershipId: 42,
        token: userToken,
        channelId: targetChannelId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a target channel not owned by the user', async function () {
      const me = await server.users.getMyInfo({ token: anotherUserToken })
      const anotherUserChannelId = me.videoChannels[0].id

      await server.changeOwnership.accept({
        ownershipId: ownershipChangeId,
        token: userToken,
        channelId: anotherUserChannelId,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.accept({
        ownershipId: ownershipChangeId,
        token: userToken,
        channelId: targetChannelId
      })
    })

    it('Should fail to accept a non pending request', async function () {
      await server.changeOwnership.accept({
        ownershipId: ownershipChangeId,
        token: userToken,
        channelId: targetChannelId,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('Delete ownership change request', function () {
    let deleteOwnershipChangeId: number
    let videoId: string

    before(async function () {
      const { uuid } = await server.videos.quickUpload({ name: 'video', token: userToken })
      videoId = uuid

      await server.changeOwnership.create({ videoId, username: 'another_user', token: userToken })

      const { data } = await server.changeOwnership.listOfVideo({ videoId })
      deleteOwnershipChangeId = data[0].id
    })

    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.delete({
        ownershipId: deleteOwnershipChangeId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing ownership id', async function () {
      await server.changeOwnership.delete({ ownershipId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a video from another user', async function () {
      await server.changeOwnership.delete({
        ownershipId: deleteOwnershipChangeId,
        token: anotherUserToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.delete({
        token: userEditorToken,
        ownershipId: deleteOwnershipChangeId
      })
    })

    it('Should fail to delete a non existing request', async function () {
      await server.changeOwnership.delete({
        ownershipId: deleteOwnershipChangeId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a non pending request', async function () {
      await server.changeOwnership.create({ videoId, username: 'another_user', token: userToken })

      const { data } = await server.changeOwnership.listOfVideo({ videoId })
      const newOwnershipChangeId = data[0].id

      await server.changeOwnership.accept({
        ownershipId: newOwnershipChangeId,
        token: anotherUserToken,
        channelId: await server.channels.getDefaultId({ token: anotherUserToken })
      })

      await server.changeOwnership.delete({
        ownershipId: newOwnershipChangeId,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
