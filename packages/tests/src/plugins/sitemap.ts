/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { HttpStatusCode, HttpStatusCodeType } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makePostBodyRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Plugin sitemap page filter', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(30000)
    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should preserve default pages without a filter', async function () {
    const res = await getPages('default')
    expect(res.text).to.contain(`<loc>${server.url}/</loc>`)
    expect(res.text).to.contain(`<loc>${server.url}/about/instance/home</loc>`)
    expect(res.text).to.contain(`<loc>${server.url}/videos/browse</loc>`)
  })

  it('Should asynchronously add, modify and remove pages', async function () {
    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-sitemap') })

    const res = await getPages('filtered')
    expect(res.headers['content-type']).to.contain('application/xml')
    expect(res.text).to.contain(`<loc>${server.url}/</loc>`)
    expect(res.text).to.contain(`<loc>${server.url}/about/instance/home</loc><lastmod>2026-01-01T00:00:00.000Z</lastmod>`)
    expect(res.text).to.not.contain(`<loc>${server.url}/videos/browse</loc>`)
    expect(res.text).to.contain(`<loc>${server.url}/plugins/test-sitemap/router/page</loc>`)

    const page = await makeGetRequest({
      url: server.url,
      path: '/plugins/test-sitemap/router/page',
      expectedStatus: HttpStatusCode.OK_200
    })
    expect(page.text).to.equal('Plugin page')

    const cached = await getPages('filtered')
    expect(cached.text).to.equal(res.text)
  })

  it('Should preserve the existing 404 behavior when all entries are removed', async function () {
    await makePostBodyRequest({
      url: server.url,
      path: '/plugins/test-sitemap/router/empty',
      fields: {},
      expectedStatus: HttpStatusCode.NO_CONTENT_204
    })

    await getPages('empty', HttpStatusCode.NOT_FOUND_404)
  })

  it('Should restore default pages after uninstalling the plugin', async function () {
    await server.plugins.uninstall({ npmName: 'peertube-plugin-test-sitemap' })
    const res = await getPages('uninstalled')
    expect(res.text).to.contain(`<loc>${server.url}/videos/browse</loc>`)
    expect(res.text).to.not.contain('/plugins/test-sitemap/router/page')
    expect(res.text).to.not.contain('<lastmod>2026-01-01')
  })

  after(async function () {
    await cleanupTests([ server ])
  })

  function getPages (cacheKey: string, expectedStatus: HttpStatusCodeType = HttpStatusCode.OK_200) {
    // Separate cache keys exercise each plugin state without waiting for expiry.
    return makeGetRequest({ url: server.url, path: '/sitemaps/pages.xml?test=' + cacheKey, expectedStatus })
  }
})
