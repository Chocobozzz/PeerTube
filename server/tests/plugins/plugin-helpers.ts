/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { cleanupTests, flushAndRunServer, ServerInfo, waitUntilLog } from '../../../shared/extra-utils/server/servers'
import { getPluginTestPath, installPlugin, setAccessTokensToServers } from '../../../shared/extra-utils'

const expect = chai.expect

describe('Test plugin helpers', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-four')
    })
  })

  it('Should have logged things', async function () {
    await waitUntilLog(server, 'localhost:' + server.port + ' peertube-plugin-test-four', 1, false)
    await waitUntilLog(server, 'Hello world from plugin four', 1)
  })

  it('Should have made a query', async function () {
    await waitUntilLog(server, `root email is admin${server.internalServerNumber}@example.com`, 1)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
