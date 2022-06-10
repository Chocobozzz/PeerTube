import { HttpStatusCode } from '@shared/models'
import { createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'

describe('Test video sources API validator', function () {
  let server: PeerTubeServer = null
  let uuid: string
  const filename = 'video_short.webm'

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    const attributes = {
      fixture: filename
    }
    const created = await server.videos.upload({ attributes, mode: 'resumable' })
    uuid = created.uuid
  })

  it('Should receive 404 when passing a non existing video id', async function () {
    const user = {
      username: 'user1',
      password: 'secret'
    }
    await setAccessTokensToServers([ server ])
    await server.users.create(user)
    const token = await server.login.getAccessToken(user)

    await server.videos.getSource({ id: '4da6fde3-88f7-4d16-b119-108df5630b06', expectedStatus: HttpStatusCode.NOT_FOUND_404, token })
  })

  it('Should not get the source as unauthenticated', async function () {
    server.accessToken = null
    await server.videos.getSource({ id: uuid, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should not get the source as another user', async function () {
    const user = {
      username: 'another_user',
      password: 'secret'
    }
    await setAccessTokensToServers([ server ])
    await server.users.create(user)
    const anotherUserToken = await server.login.getAccessToken(user)
    await server.videos.getSource({ id: uuid, token: anotherUserToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })
})
