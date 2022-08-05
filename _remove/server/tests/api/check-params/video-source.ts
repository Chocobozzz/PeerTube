import { HttpStatusCode } from '@shared/models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'

describe('Test video sources API validator', function () {
  let server: PeerTubeServer = null
  let uuid: string
  let userToken: string

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    const created = await server.videos.quickUpload({ name: 'video' })
    uuid = created.uuid

    userToken = await server.users.generateUserAndToken('user')
  })

  it('Should fail without a valid uuid', async function () {
    await server.videos.getSource({ id: '4da6fde3-88f7-4d16-b119-108df563d0b0', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should receive 404 when passing a non existing video id', async function () {
    await server.videos.getSource({ id: '4da6fde3-88f7-4d16-b119-108df5630b06', expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should not get the source as unauthenticated', async function () {
    await server.videos.getSource({ id: uuid, expectedStatus: HttpStatusCode.UNAUTHORIZED_401, token: null })
  })

  it('Should not get the source with another user', async function () {
    await server.videos.getSource({ id: uuid, expectedStatus: HttpStatusCode.FORBIDDEN_403, token: userToken })
  })

  it('Should succeed with the correct parameters get the source as another user', async function () {
    await server.videos.getSource({ id: uuid })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
