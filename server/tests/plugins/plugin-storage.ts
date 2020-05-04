/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { getPluginTestPath, installPlugin, setAccessTokensToServers } from '../../../shared/extra-utils'
import { cleanupTests, flushAndRunServer, ServerInfo, waitUntilLog } from '../../../shared/extra-utils/server/servers'

describe('Test plugin storage', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-six')
    })
  })

  it('Should correctly store a subkey', async function () {
    await waitUntilLog(server, 'superkey stored value is toto')
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
