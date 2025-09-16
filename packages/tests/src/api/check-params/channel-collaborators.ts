/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test video channel collaborators API validators', function () {
  let server: PeerTubeServer
  let remoteServer: PeerTubeServer

  let collaboratorToken: string
  let collaboratorId: number

  let collaboratorId2: number

  let unrelatedCollaboratorId: number

  let userToken: string

  before(async function () {
    this.timeout(60000)

    const servers = await createMultipleServers(2, {
      rates_limit: {
        login: {
          max: 100
        }
      }
    })

    server = servers[0]
    remoteServer = servers[1]
    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[1].videos.quickUpload({ name: 'remote video' })

    collaboratorToken = await server.users.generateUserAndToken('collaborator')
    await server.users.generateUserAndToken('collaborator2')
    userToken = await server.users.generateUserAndToken('user1')

    await server.users.generateUserAndToken('user2')

    const { id } = await server.channelCollaborators.invite({ channel: 'user1_channel', target: 'user2' })
    unrelatedCollaboratorId = id

    await waitJobs(servers)
  })

  describe('Invite', function () {
    it('Should fail when not authenticated', async function () {
      await server.channelCollaborators.invite({
        token: null,
        channel: 'root_channel',
        target: 'collaborator',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a bad channel handle', async function () {
      await server.channelCollaborators.invite({
        channel: 'bad handle',
        target: 'collaborator',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })

      await server.channelCollaborators.invite({
        channel: 'root_channel@' + remoteServer.host,
        target: 'collaborator',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a non owned channel', async function () {
      await server.channelCollaborators.invite({
        token: userToken,
        channel: 'root_channel',
        target: 'collaborator',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with a bad account handle', async function () {
      await server.channelCollaborators.invite({
        channel: 'root_channel',
        target: 'bad handle',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })

      await server.channelCollaborators.invite({
        channel: 'root_channel',
        target: 'root@' + remoteServer.host,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with myself', async function () {
      await server.channelCollaborators.invite({
        channel: 'root_channel',
        target: 'root',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail for a collaborator to invite another collaborator', async function () {
      const collaboratorToken = await server.channelCollaborators.createEditor('editor', 'root_channel')

      await server.channelCollaborators.invite({
        token: collaboratorToken,
        channel: 'root_channel',
        target: 'collaborator2',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct parameters', async function () {
      {
        const { id } = await server.channelCollaborators.invite({ channel: 'root_channel', target: 'collaborator' })
        collaboratorId = id
      }

      {
        const { id } = await server.channelCollaborators.invite({ channel: 'root_channel', target: 'collaborator2' })
        collaboratorId2 = id
      }
    })

    it('Should fail to re-invite the user', async function () {
      await server.channelCollaborators.invite({
        channel: 'root_channel',
        target: 'collaborator',
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should limit the number of collaborators', async function () {
      const claireToken = await server.users.generateUserAndToken('claire')

      for (let i = 0; i < 20; i++) {
        await server.channelCollaborators.createEditor('editor' + i, 'claire_channel')
      }

      await server.users.generateUserAndToken('celie')

      await server.channelCollaborators.invite({
        channel: 'claire_channel',
        token: claireToken,
        target: 'celie',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('Common Accept/Reject', function () {
    it('Should fail when not authenticated', async function () {
      const options = {
        token: null,
        channel: 'root_channel',
        id: collaboratorId,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      }

      await server.channelCollaborators.accept(options)
    })

    it('Should fail to accept the collaborator with another user', async function () {
      const options = {
        token: userToken,
        channel: 'root_channel',
        id: collaboratorId,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      }

      await server.channelCollaborators.accept(options)
    })

    it('Should fail with an invalid collaborator id', async function () {
      {
        const options = {
          token: collaboratorToken,
          channel: 'root_channel',
          id: 'toto' as any,
          expectedStatus: HttpStatusCode.BAD_REQUEST_400
        }

        await server.channelCollaborators.accept(options)

        {
          const options = {
            token: collaboratorToken,
            channel: 'root_channel',
            id: 42,
            expectedStatus: HttpStatusCode.NOT_FOUND_404
          }

          await server.channelCollaborators.accept(options)
        }
      }
    })

    it('Should fail with a bad channel handle', async function () {
      {
        const options = {
          token: collaboratorToken,
          channel: 'bad handle',
          id: collaboratorId,
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        }

        await server.channelCollaborators.accept(options)
      }

      {
        const options = {
          token: collaboratorToken,
          channel: 'root_channel@' + remoteServer.host,
          id: collaboratorId,
          expectedStatus: HttpStatusCode.FORBIDDEN_403
        }

        await server.channelCollaborators.accept(options)
      }
    })

    it('Should fail with another channel than the collaborator id', async function () {
      const options = {
        token: collaboratorToken,
        channel: 'user1_channel',
        id: collaboratorId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      }

      await server.channelCollaborators.accept(options)
    })

    it('Should fail to accept another collaborator invitation', async function () {
      const options = {
        token: collaboratorToken,
        channel: 'root_channel',
        id: collaboratorId2,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      }

      await server.channelCollaborators.accept(options)
    })

    it('Should fail with a channel not related to the collaborator id', async function () {
      {
        const options = {
          token: collaboratorToken,
          channel: 'root_channel',
          id: unrelatedCollaboratorId,
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        }

        await server.channelCollaborators.accept(options)
      }

      {
        const options = {
          token: collaboratorToken,
          channel: 'user1_channel',
          id: collaboratorId,
          expectedStatus: HttpStatusCode.NOT_FOUND_404
        }

        await server.channelCollaborators.accept(options)
      }
    })
  })

  describe('Accept', function () {
    it('Should succeed with the correct params', async function () {
      await server.channelCollaborators.accept({
        token: collaboratorToken,
        channel: 'root_channel',
        id: collaboratorId
      })
    })

    it('Should fail to re-accept the same collaborator', async function () {
      await server.channelCollaborators.accept({
        token: collaboratorToken,
        channel: 'root_channel',
        id: collaboratorId,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail to invite an accepted collaborator', async function () {
      await server.channelCollaborators.invite({
        channel: 'root_channel',
        target: 'collaborator',
        expectedStatus: HttpStatusCode.CONFLICT_409
      })
    })

    it('Should fail to invite another collaborator with an existing collaborator token', async function () {
      await server.channelCollaborators.invite({
        token: collaboratorToken,
        channel: 'root_channel',
        target: 'collaborator2',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })
  })

  describe('Remove', function () {
    it('Should fail when not authenticated', async function () {
      await server.channelCollaborators.remove({
        token: null,
        channel: 'root_channel',
        id: collaboratorId,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail to remove the collaborator with another user', async function () {
      await server.channelCollaborators.remove({
        token: userToken,
        channel: 'root_channel',
        id: collaboratorId,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an invalid collaborator id', async function () {
      await server.channelCollaborators.remove({
        token: collaboratorToken,
        channel: 'root_channel',
        id: 'toto' as any,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await server.channelCollaborators.remove({
        token: collaboratorToken,
        channel: 'root_channel',
        id: 42,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a bad channel handle', async function () {
      await server.channelCollaborators.remove({
        token: collaboratorToken,
        channel: 'bad handle',
        id: collaboratorId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })

      await server.channelCollaborators.remove({
        token: collaboratorToken,
        channel: 'root@' + remoteServer.host,
        id: collaboratorId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a channel not related to the collaborator id', async function () {
      await server.channelCollaborators.remove({
        token: collaboratorToken,
        channel: 'root_channel',
        id: unrelatedCollaboratorId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })

      await server.channelCollaborators.remove({
        token: collaboratorToken,
        channel: 'user1_channel',
        id: collaboratorId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail for a collaborator to remove another collaborator', async function () {
      await server.channelCollaborators.remove({
        token: collaboratorToken,
        channel: 'root_channel',
        id: collaboratorId2,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should succeed with the correct params', async function () {
      await server.channelCollaborators.remove({
        token: collaboratorToken,
        channel: 'root_channel',
        id: collaboratorId
      })

      await server.channelCollaborators.remove({
        token: server.accessToken,
        channel: 'root_channel',
        id: collaboratorId2
      })
    })
  })

  describe('Reject', function () {
    before(async function () {
      const { id } = await server.channelCollaborators.invite({ channel: 'root_channel', target: 'collaborator' })
      collaboratorId = id
    })

    it('Should succeed with the correct params', async function () {
      await server.channelCollaborators.reject({
        token: collaboratorToken,
        channel: 'root_channel',
        id: collaboratorId
      })
    })

    it('Should fail to reject the same collaborator', async function () {
      await server.channelCollaborators.reject({
        token: collaboratorToken,
        channel: 'root_channel',
        id: collaboratorId,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  describe('List', function () {
    before(async function () {
      const { id } = await server.channelCollaborators.invite({ channel: 'root_channel', target: 'collaborator' })
      collaboratorId = id
    })

    it('Should fail when not authenticated', async function () {
      await server.channelCollaborators.list({
        token: null,
        channel: 'root_channel',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a bad channel handle', async function () {
      await server.channelCollaborators.list({
        token: userToken,
        channel: 'bad handle',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })

      await server.channelCollaborators.list({
        token: userToken,
        channel: 'root@' + remoteServer.host,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with a non owned channel', async function () {
      await server.channelCollaborators.list({
        token: userToken,
        channel: 'root_channel',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail to list if the collaborator is not accepted yet', async function () {
      await server.channelCollaborators.list({
        token: collaboratorToken,
        channel: 'root_channel',
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })

      await server.channelCollaborators.accept({ token: collaboratorToken, channel: 'root_channel', id: collaboratorId })

      await server.channelCollaborators.list({
        token: collaboratorToken,
        channel: 'root_channel'
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await server.channelCollaborators.list({ channel: 'root_channel' })
    })
  })

  after(async function () {
    await cleanupTests([ server, remoteServer ])
  })
})
