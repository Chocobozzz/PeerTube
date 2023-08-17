/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { HttpStatusCode } from '@peertube/peertube-models'

describe('Test plugins module unloading', function () {
  let server: PeerTubeServer = null
  const requestPath = '/plugins/test-unloading/router/get'
  let value: string = null

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-unloading') })
  })

  it('Should return a numeric value', async function () {
    const res = await makeGetRequest({
      url: server.url,
      path: requestPath,
      expectedStatus: HttpStatusCode.OK_200
    })

    expect(res.body.message).to.match(/^\d+$/)
    value = res.body.message
  })

  it('Should return the same value the second time', async function () {
    const res = await makeGetRequest({
      url: server.url,
      path: requestPath,
      expectedStatus: HttpStatusCode.OK_200
    })

    expect(res.body.message).to.be.equal(value)
  })

  it('Should uninstall the plugin and free the route', async function () {
    await server.plugins.uninstall({ npmName: 'peertube-plugin-test-unloading' })

    await makeGetRequest({
      url: server.url,
      path: requestPath,
      expectedStatus: HttpStatusCode.NOT_FOUND_404
    })
  })

  it('Should return a different numeric value', async function () {
    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-unloading') })

    const res = await makeGetRequest({
      url: server.url,
      path: requestPath,
      expectedStatus: HttpStatusCode.OK_200
    })

    expect(res.body.message).to.match(/^\d+$/)
    expect(res.body.message).to.be.not.equal(value)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
