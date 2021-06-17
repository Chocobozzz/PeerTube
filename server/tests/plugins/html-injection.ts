/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  flushAndRunServer,
  getPluginsCSS,
  installPlugin,
  makeHTMLRequest,
  ServerInfo,
  setAccessTokensToServers,
  uninstallPlugin
} from '../../../shared/extra-utils'

const expect = chai.expect

describe('Test plugins HTML injection', function () {
  let server: ServerInfo = null

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should not inject global css file in HTML', async function () {
    {
      const res = await getPluginsCSS(server.url)
      expect(res.text).to.be.empty
    }

    for (const path of [ '/', '/videos/embed/1', '/video-playlists/embed/1' ]) {
      const res = await makeHTMLRequest(server.url, path)
      expect(res.text).to.not.include('link rel="stylesheet" href="/plugins/global.css')
    }
  })

  it('Should install a plugin and a theme', async function () {
    this.timeout(30000)

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-hello-world'
    })
  })

  it('Should have the correct global css', async function () {
    {
      const res = await getPluginsCSS(server.url)
      expect(res.text).to.contain('background-color: red')
    }

    for (const path of [ '/', '/videos/embed/1', '/video-playlists/embed/1' ]) {
      const res = await makeHTMLRequest(server.url, path)
      expect(res.text).to.include('link rel="stylesheet" href="/plugins/global.css')
    }
  })

  it('Should have an empty global css on uninstall', async function () {
    await uninstallPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-hello-world'
    })

    {
      const res = await getPluginsCSS(server.url)
      expect(res.text).to.be.empty
    }

    for (const path of [ '/', '/videos/embed/1', '/video-playlists/embed/1' ]) {
      const res = await makeHTMLRequest(server.url, path)
      expect(res.text).to.not.include('link rel="stylesheet" href="/plugins/global.css')
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
