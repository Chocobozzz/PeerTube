/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { cleanupTests, flushAndRunServer, ServerInfo } from '../../../shared/extra-utils/server/servers'
import { getPluginTestPath, installPlugin, setAccessTokensToServers } from '../../../shared/extra-utils'

describe('Test id and pass auth plugins', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-id-pass-auth-one')
    })

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-id-pass-auth-two')
    })
  })

  it('Should not login', async function() {

  })

  it('Should login Spyro, create the user and use the token', async function() {

  })

  it('Should login Crash, create the user and use the token', async function() {

  })

  it('Should login the first Laguna, create the user and use the token', async function() {

  })

  it('Should update Crash profile', async function () {

  })

  it('Should logout Crash', async function () {

    // test token
  })

  it('Should have logged the Crash logout', async function () {

  })

  it('Should login Crash and keep the old existing profile', async function () {

  })

  it('Should uninstall the plugin one and do not login existing Crash', async function () {

  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
