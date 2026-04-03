/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { ChangeOwnershipState, HttpStatusCode } from '@peertube/peertube-models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'
import { expect } from 'chai'

describe('Test channel change ownership API validator', function () {
  let server: PeerTubeServer
  let userToken: string
  let anotherUserToken: string
  let rootEditorToken: string
  let userEditorToken: string
  let ownershipChangeId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    await server.channels.create({ attributes: { name: 'root_channel_1' } })
    await server.channels.create({ attributes: { name: 'root_channel_2' } })

    userToken = await server.users.generateUserAndToken('user')
    anotherUserToken = await server.users.generateUserAndToken('another_user')
    rootEditorToken = await server.channelCollaborators.createEditor('root_editor', 'root_channel_1')
    userEditorToken = await server.channelCollaborators.createEditor('user_editor', 'user_channel')
  })

  describe('Create channel ownership change request', function () {
    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.createChannel({
        channelName: 'user_channel',
        username: 'another_user',
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a channel of another user', async function () {
      for (const token of [ userToken, userEditorToken ]) {
        await server.changeOwnership.createChannel({
          channelName: 'root_channel',
          username: 'another_user',
          token,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail with a non existing target', async function () {
      await server.changeOwnership.createChannel({
        channelName: 'user_channel',
        username: 'unexisting',
        token: userToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with a non existing channel', async function () {
      await server.changeOwnership.createChannel({
        channelName: 'non_existing_channel',
        username: 'another_user',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with the token of a collaborator', async function () {
      await server.changeOwnership.createChannel({
        channelName: 'root_channel_1',
        username: 'user',
        token: rootEditorToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail if the target is already the owner of the video', async function () {
      await server.changeOwnership.createChannel({
        channelName: 'root_channel_1',
        username: 'root',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.createChannel({ channelName: 'root_channel_1', username: 'user' })
    })

    it('Should fail to create a request for a channel with a pending ownership change request', async function () {
      await server.changeOwnership.createChannel({
        channelName: 'root_channel_1',
        username: 'user',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('List ownership change requests', function () {
    it('Should fail with bad pagination/sort params', async function () {
      await checkBadStartPagination(server.url, '/api/v1/video-channels/ownership', server.accessToken)
      await checkBadCountPagination(server.url, '/api/v1/video-channels/ownership', server.accessToken)
      await checkBadSort(server.url, '/api/v1/video-channels/ownership', server.accessToken)
    })

    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.listChannels({ token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should succeed with valid params', async function () {
      const { data } = await server.changeOwnership.listChannels({ token: userToken })
      ownershipChangeId = data[0].id
    })
  })

  describe('List ownership changes of a specific channel', function () {
    it('Should fail with bad pagination/sort params', async function () {
      await checkBadStartPagination(server.url, '/api/v1/video-channels/root_channel_1/ownership', server.accessToken)
      await checkBadCountPagination(server.url, '/api/v1/video-channels/root_channel_1/ownership', server.accessToken)
      await checkBadSort(server.url, '/api/v1/video-channels/root_channel_1/ownership', server.accessToken)
    })

    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.listOfChannel({
        channelName: 'root_channel_1',
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing channel', async function () {
      await server.changeOwnership.listOfChannel({
        channelName: 'non_existing_channel',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a channel of another user', async function () {
      for (const token of [ userToken, userEditorToken ]) {
        await server.changeOwnership.listOfChannel({
          channelName: 'root_channel_1',
          token,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail with an invalid state parameter', async function () {
      await server.changeOwnership.listOfChannel({
        channelName: 'root_channel_1',
        state: 'INVALID_STATE' as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with valid params', async function () {
      for (const token of [ server.accessToken, rootEditorToken ]) {
        const { data, total } = await server.changeOwnership.listOfChannel({
          token,
          channelName: 'root_channel_1'
        })
        expect(total).to.be.a('number')
        expect(data).to.be.an('array')
      }
    })

    it('Should succeed with a state filter', async function () {
      const { data } = await server.changeOwnership.listOfChannel({
        channelName: 'root_channel_1',
        state: ChangeOwnershipState.PENDING
      })
      expect(data).to.be.an('array')
    })
  })

  describe('Reject ownership change request', function () {
    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.refuseChannel({
        ownershipId: ownershipChangeId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing ownership id', async function () {
      await server.changeOwnership.refuseChannel({ ownershipId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a ownership of another user', async function () {
      for (const token of [ userEditorToken, anotherUserToken, rootEditorToken ]) {
        await server.changeOwnership.refuseChannel({
          ownershipId: ownershipChangeId,
          token,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail to refuse using the video endpoint', async function () {
      await server.changeOwnership.refuseVideo({
        ownershipId: ownershipChangeId,
        token: userToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.refuseChannel({ ownershipId: ownershipChangeId, token: userToken })
    })

    it('Should fail to reject a non pending request', async function () {
      await server.changeOwnership.refuseChannel({
        ownershipId: ownershipChangeId,
        token: userToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('Accept ownership change request', function () {
    before(async function () {
      await server.changeOwnership.createChannel({
        channelName: 'root_channel_2',
        username: 'user'
      })

      const { data } = await server.changeOwnership.listChannels({ token: userToken, sort: '-createdAt' })
      ownershipChangeId = data[0].id
    })

    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.acceptChannel({
        ownershipId: ownershipChangeId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing ownership id', async function () {
      await server.changeOwnership.acceptChannel({
        ownershipId: 42,
        token: userToken,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a ownership of another user', async function () {
      for (const token of [ userEditorToken, anotherUserToken ]) {
        await server.changeOwnership.acceptChannel({
          ownershipId: ownershipChangeId,
          token,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        })
      }
    })

    it('Should fail with a non existing target', async function () {
      await server.changeOwnership.acceptChannel({
        ownershipId: 42,
        token: userToken,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.acceptChannel({
        ownershipId: ownershipChangeId,
        token: userToken
      })
    })

    it('Should fail to accept a non pending request', async function () {
      await server.changeOwnership.acceptChannel({
        ownershipId: ownershipChangeId,
        token: userToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('Delete ownership change request', function () {
    let deleteOwnershipChangeId: number

    before(async function () {
      await server.changeOwnership.createChannel({ channelName: 'root_channel_2', username: 'another_user' })

      const { data } = await server.changeOwnership.listOfChannel({ channelName: 'root_channel_2' })
      deleteOwnershipChangeId = data[0].id
    })

    it('Should fail if not authenticated', async function () {
      await server.changeOwnership.deleteChannel({
        ownershipId: deleteOwnershipChangeId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a non existing ownership id', async function () {
      await server.changeOwnership.deleteChannel({ ownershipId: 42, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail by another user', async function () {
      await server.changeOwnership.deleteChannel({
        ownershipId: deleteOwnershipChangeId,
        token: anotherUserToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail by an editor', async function () {
      await server.changeOwnership.deleteChannel({
        ownershipId: deleteOwnershipChangeId,
        token: rootEditorToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with valid params', async function () {
      await server.changeOwnership.deleteChannel({ ownershipId: deleteOwnershipChangeId })
    })

    it('Should fail to delete a non existing request', async function () {
      await server.changeOwnership.deleteChannel({
        ownershipId: deleteOwnershipChangeId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a non pending request', async function () {
      await server.changeOwnership.createChannel({ channelName: 'root_channel_2', username: 'another_user', token: userToken })

      const { data } = await server.changeOwnership.listOfChannel({ channelName: 'root_channel_2' })
      const newOwnershipChangeId = data[0].id

      await server.changeOwnership.acceptChannel({ ownershipId: newOwnershipChangeId, token: anotherUserToken })

      await server.changeOwnership.deleteChannel({ ownershipId: newOwnershipChangeId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
