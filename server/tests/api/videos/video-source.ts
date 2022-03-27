import 'mocha'
import * as chai from 'chai'
import { createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'
import { UserRole } from '@shared/models'

const expect = chai.expect

describe('Test video source', () => {
  let server: PeerTubeServer = null
  let uuid: string
  const filename = 'video_short.webm'

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
  })

  it('Should get the source filename', async function () {
    this.timeout(10000)

    const attributes = {
      fixture: filename
    }
    const created = await server.videos.upload({ attributes, mode: 'resumable' })
    uuid = created.uuid
    const video = await server.videos.getWithToken({ id: uuid })

    expect(video.sources[0].filename).to.equal(filename)
  })

  it('Should not get the source as unauthenticated', async function () {
    const video = await server.videos.get({ id: uuid })

    expect(video.sources).to.equal(undefined)
  })

  it('Should not get the source as another user', async function () {
    const user = {
      username: 'another_user',
      password: 'secret'
    }
    await server.users.create(user)
    const anotherUserToken = await server.login.getAccessToken(user)
    const video = await server.videos.getWithToken({ id: uuid, token: anotherUserToken })

    expect(video.sources).to.equal(undefined)
  })

  it('Should get the source as moderator', async function () {
    const user = {
      username: 'moderator',
      password: 'secret',
      role: UserRole.MODERATOR
    }
    await server.users.create(user)
    const anotherUserToken = await server.login.getAccessToken(user)
    const video = await server.videos.getWithToken({ id: uuid, token: anotherUserToken })

    expect(video.sources[0].filename).to.equal(filename)
  })
})
