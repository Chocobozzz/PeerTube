import 'mocha'
import * as request from 'supertest'
import { PeerTubeServer } from '../../../../shared/extra-utils'
import { cleanupTests, createSingleServer } from '../../../../shared/extra-utils/server/servers'
import { HttpStatusCode } from '../../../../shared/core-utils/miscs/http-error-codes'

describe('Start and stop server without web client routes', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1, {}, [ '--no-client' ])
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
