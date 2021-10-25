import 'mocha'
import request from 'supertest'
import { cleanupTests, createSingleServer, PeerTubeServer } from '@shared/extra-utils'
import { HttpStatusCode } from '@shared/models'

describe('Start and stop server without web client routes', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1, {}, { peertubeArgs: [ '--no-client' ] })
  })

  it('Should fail getting the client', function () {
    const req = request(server.url)
      .get('/')

    return req.expect(HttpStatusCode.NOT_FOUND_404)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
