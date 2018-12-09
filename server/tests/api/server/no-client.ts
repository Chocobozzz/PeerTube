import 'mocha'
import * as request from 'supertest'
import {
  flushTests,
  killallServers,
  ServerInfo
} from '../../../../shared/utils'
import { runServer } from '../../../../shared/utils/server/servers'

describe('Start and stop server without web client routes', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1, {}, ['--no-client'])
  })

  it('Should fail getting the client', function () {
    const req = request(server.url)
      .get('/')

    return req.expect(404)
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
