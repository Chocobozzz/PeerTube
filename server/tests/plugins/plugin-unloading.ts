/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
  cleanupTests,
  flushAndRunServer,
  getPluginTestPath,
  makeGetRequest,
  installPlugin,
  uninstallPlugin,
  ServerInfo,
  setAccessTokensToServers
} from '../../../shared/extra-utils'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { expect } from 'chai'

describe('Test plugins module unloading', function () {
  let server: ServerInfo = null
  const requestPath = '/plugins/test-unloading/router/get'
  let value: string = null

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-unloading')
    })
  })

  it('Should return a numeric value', async function () {
    const res = await makeGetRequest({
      url: server.url,
      path: requestPath,
      statusCodeExpected: HttpStatusCode.OK_200
    })

    expect(res.body.message).to.match(/^\d+$/)
    value = res.body.message
  })

  it('Should return the same value the second time', async function () {
    const res = await makeGetRequest({
      url: server.url,
      path: requestPath,
      statusCodeExpected: HttpStatusCode.OK_200
    })

    expect(res.body.message).to.be.equal(value)
  })

  it('Should uninstall the plugin and free the route', async function () {
    await uninstallPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-test-unloading'
    })

    await makeGetRequest({
      url: server.url,
      path: requestPath,
      statusCodeExpected: HttpStatusCode.NOT_FOUND_404
    })
  })

  it('Should return a different numeric value', async function () {
    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-unloading')
    })
    const res = await makeGetRequest({
      url: server.url,
      path: requestPath,
      statusCodeExpected: HttpStatusCode.OK_200
    })

    expect(res.body.message).to.match(/^\d+$/)
    expect(res.body.message).to.be.not.equal(value)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
