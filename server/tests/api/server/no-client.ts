import 'mocha'
import * as request from 'supertest'
import { ServerInfo } from '../../../../shared/extra-utils'
import { cleanupTests, flushAndRunServer } from '../../../../shared/extra-utils/server/servers'

describe('Start and stop server without web client routes', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1, {}, [ '--no-client' ])
  })

  it('Should fail getting the client', function () {
    const req = request(server.url)
      .get('/')

    return req.expect(404)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
