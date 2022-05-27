import 'mocha'
import * as chai from 'chai'
import { createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'
import { HttpStatusCode, UserRole } from '@shared/models'

const expect = chai.expect

describe('Test video source', () => {
  let server: PeerTubeServer = null
  let uuid: string
  const filename = 'video_short.webm'

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
  })

  it('Should get the source filename', async function () {
    this.timeout(10000)
    await setAccessTokensToServers([ server ])

    const attributes = {
      fixture: filename
    }
    const created = await server.videos.upload({ attributes, mode: 'resumable' })
    uuid = created.uuid
    const source = await server.videos.getSource({ id: uuid, token: server.accessToken })

    expect(source.filename).to.equal(filename)
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

  it('Should get the source as moderator', async function () {
    const user = {
      username: 'moderator',
      password: 'secret',
      role: UserRole.MODERATOR
    }
    await setAccessTokensToServers([ server ])
    await server.users.create(user)
    const anotherUserToken = await server.login.getAccessToken(user)
    const source = await server.videos.getSource({ id: uuid, token: anotherUserToken })

    expect(source.filename).to.equal(filename)
  })
})
