/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { HttpStatusCode } from '@shared/core-utils'
import { CustomPage, ServerConfig } from '@shared/models'
import {
  cleanupTests,
  flushAndRunServer,
  getConfig,
  getInstanceHomepage,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  updateInstanceHomepage
} from '../../../../shared/extra-utils/index'

const expect = chai.expect

async function getMenuEntries (server: ServerInfo) {
  const res = await getConfig(server.url)

  const config = res.body as ServerConfig
  return config.menu.entries
}

describe('Test instance homepage actions', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should not have a homepage', async function () {
    const menuEntries = await getMenuEntries(server)
    expect(menuEntries).to.have.lengthOf(4)
    expect(menuEntries[0].id).to.equal('videos-overview')
    expect(menuEntries[0].path).to.equal('/videos/overview')

    await getInstanceHomepage(server.url, HttpStatusCode.NOT_FOUND_404)
  })

  it('Should set a homepage', async function () {
    await updateInstanceHomepage(server.url, server.accessToken, '<picsou-magazine></picsou-magazine>')

    const res = await getInstanceHomepage(server.url)
    const page: CustomPage = res.body
    expect(page.content).to.equal('<picsou-magazine></picsou-magazine>')

    const menuEntries = await getMenuEntries(server)
    expect(menuEntries).to.have.lengthOf(5)
    expect(menuEntries[0].id).to.equal('home')
    expect(menuEntries[0].path).to.equal('/home')
  })

  it('Should have the same homepage after a restart', async function () {
    this.timeout(30000)

    killallServers([ server ])

    await reRunServer(server)

    const res = await getInstanceHomepage(server.url)
    const page: CustomPage = res.body
    expect(page.content).to.equal('<picsou-magazine></picsou-magazine>')

    const menuEntries = await getMenuEntries(server)
    expect(menuEntries).to.have.lengthOf(5)
    expect(menuEntries[0].id).to.equal('home')
    expect(menuEntries[0].path).to.equal('/home')
  })

  it('Should empty the homepage', async function () {
    await updateInstanceHomepage(server.url, server.accessToken, '')

    const res = await getInstanceHomepage(server.url)
    const page: CustomPage = res.body
    expect(page.content).to.be.empty

    const menuEntries = await getMenuEntries(server)
    expect(menuEntries).to.have.lengthOf(4)
    expect(menuEntries[0].id).to.equal('videos-overview')
    expect(menuEntries[0].path).to.equal('/videos/overview')
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
