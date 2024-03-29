/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makePostBodyRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { HttpStatusCode } from '@peertube/peertube-models'

describe('Test plugin helpers', function () {
  let server: PeerTubeServer
  const basePaths = [
    '/plugins/test-five/router/',
    '/plugins/test-five/0.0.1/router/'
  ]

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-five') })
  })

  it('Should answer "pong"', async function () {
    for (const path of basePaths) {
      const res = await makeGetRequest({
        url: server.url,
        path: path + 'ping',
        expectedStatus: HttpStatusCode.OK_200
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
        expectedStatus: 200
      })

      expect(res.body.isAuthenticated).to.equal(true)

      const secRes = await makeGetRequest({
        url: server.url,
        path: path + 'is-authenticated',
        expectedStatus: 200
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
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body).to.deep.equal(body)
    }
  })

  it('Should mirror the raw post body', async function () {
    const body = {
      torso: 'arms',
      legs: 'feet'
    }

    for (const path of basePaths) {
      const res = await makePostBodyRequest({
        url: server.url,
        path: path + 'form/post/mirror-raw-body',
        fields: body,
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body).to.deep.equal(body)
    }
  })

  it('Should remove the plugin and remove the routes', async function () {
    await server.plugins.uninstall({ npmName: 'peertube-plugin-test-five' })

    for (const path of basePaths) {
      await makeGetRequest({
        url: server.url,
        path: path + 'ping',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })

      await makePostBodyRequest({
        url: server.url,
        path: path + 'ping',
        fields: {},
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
