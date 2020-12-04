/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { cleanupTests, flushAndRunServer, ServerInfo } from '../../../shared/extra-utils/server/servers'
import {
  getPluginTestPath,
  installPlugin,
  makeGetRequest,
  makePostBodyRequest,
  setAccessTokensToServers, uninstallPlugin
} from '../../../shared/extra-utils'
import { expect } from 'chai'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

describe('Test plugin helpers', function () {
  let server: ServerInfo
  const basePaths = [
    '/plugins/test-five/router/',
    '/plugins/test-five/0.0.1/router/'
  ]

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-five')
    })
  })

  it('Should answer "pong"', async function () {
    for (const path of basePaths) {
      const res = await makeGetRequest({
        url: server.url,
        path: path + 'ping',
        statusCodeExpected: HttpStatusCode.OK_200
      })

      expect(res.body.message).to.equal('pong')
    }
  })

  it('Should check if authenticated', async function () {
    for (const path of basePaths) {
      const res = await makeGetRequest({
        url: server.url,
        path: path + 'is-authenticated',
        token: server.accessToken,
        statusCodeExpected: 200
      })

      expect(res.body.isAuthenticated).to.equal(true)

      const secRes = await makeGetRequest({
        url: server.url,
        path: path + 'is-authenticated',
        statusCodeExpected: 200
      })

      expect(secRes.body.isAuthenticated).to.equal(false)
    }
  })

  it('Should mirror post body', async function () {
    const body = {
      hello: 'world',
      riri: 'fifi',
      loulou: 'picsou'
    }

    for (const path of basePaths) {
      const res = await makePostBodyRequest({
        url: server.url,
        path: path + 'form/post/mirror',
        fields: body,
        statusCodeExpected: HttpStatusCode.OK_200
      })

      expect(res.body).to.deep.equal(body)
    }
  })

  it('Should remove the plugin and remove the routes', async function () {
    await uninstallPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-test-five'
    })

    for (const path of basePaths) {
      await makeGetRequest({
        url: server.url,
        path: path + 'ping',
        statusCodeExpected: HttpStatusCode.NOT_FOUND_404
      })

      await makePostBodyRequest({
        url: server.url,
        path: path + 'ping',
        fields: {},
        statusCodeExpected: HttpStatusCode.NOT_FOUND_404
      })
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
