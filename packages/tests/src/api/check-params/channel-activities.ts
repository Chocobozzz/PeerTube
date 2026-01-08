import { HttpStatusCode } from '@peertube/peertube-models'
import {
  createSingleServer,
  killallServers,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { checkBadCountPagination, checkBadSort, checkBadStartPagination } from '@tests/shared/checks.js'

describe('Test video channel activities API validator', () => {
  const path = '/api/v1/video-channels/root_channel/activities'
  let server: PeerTubeServer
  let userToken: string
  let editorToken: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    userToken = await server.users.generateUserAndToken('user')
    editorToken = await server.channelCollaborators.createEditor('editor', 'root_channel')
  })

  describe('When listing channel activities', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSort(server.url, path, server.accessToken)
    })

    it('Should fail without authentication', async function () {
      await server.channels.listActivities({ token: null, channelName: 'invalid', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with a bad channel', async function () {
      await server.channels.listActivities({ channelName: 'invalid', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a non owned channel', async function () {
      await server.channels.listActivities({ token: userToken, channelName: 'root_channel', expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with correct parameters', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: server.accessToken,
        expectedStatus: HttpStatusCode.OK_200
      })

      await server.channels.listActivities({
        channelName: 'root_channel',
        start: 0,
        count: 10,
        sort: '-createdAt'
      })

      await server.channels.listActivities({
        token: editorToken,
        channelName: 'root_channel',
        start: 0,
        count: 10,
        sort: '-createdAt'
      })
    })
  })

  after(async function () {
    await killallServers([ server ])
  })
})
