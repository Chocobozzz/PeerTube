import 'mocha'
import * as chai from 'chai'
import { createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'

const expect = chai.expect

describe('Test video source', () => {
  let server: PeerTubeServer = null
  let uuid: string
  const fixture = 'video_short.webm'

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    const created = await server.videos.quickUpload({ name: 'video', fixture })
    uuid = created.uuid
  })

  it('Should get the source filename', async function () {
    this.timeout(30000)

    const source = await server.videos.getSource({ id: uuid, token: server.accessToken })
    expect(source.filename).to.equal(fixture)
  })
})
