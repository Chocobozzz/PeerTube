import { expect } from 'chai'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@shared/server-commands'

describe('Test video source', () => {
  let server: PeerTubeServer = null
  const fixture = 'video_short.webm'

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should get the source filename with legacy upload', async function () {
    this.timeout(30000)

    const { uuid } = await server.videos.upload({ attributes: { name: 'my video', fixture }, mode: 'legacy' })

    const source = await server.videos.getSource({ id: uuid })
    expect(source.filename).to.equal(fixture)
  })

  it('Should get the source filename with resumable upload', async function () {
    this.timeout(30000)

    const { uuid } = await server.videos.upload({ attributes: { name: 'my video', fixture }, mode: 'resumable' })

    const source = await server.videos.getSource({ id: uuid })
    expect(source.filename).to.equal(fixture)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
