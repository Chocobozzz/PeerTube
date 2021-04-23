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

async function getHomepageState (server: ServerInfo) {
  const res = await getConfig(server.url)

  const config = res.body as ServerConfig
  return config.homepage.enabled
}

describe('Test instance homepage actions', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should not have a homepage', async function () {
    const state = await getHomepageState(server)
    expect(state).to.be.false

    await getInstanceHomepage(server.url, HttpStatusCode.NOT_FOUND_404)
  })

  it('Should set a homepage', async function () {
    await updateInstanceHomepage(server.url, server.accessToken, '<picsou-magazine></picsou-magazine>')

    const res = await getInstanceHomepage(server.url)
    const page: CustomPage = res.body
    expect(page.content).to.equal('<picsou-magazine></picsou-magazine>')

    const state = await getHomepageState(server)
    expect(state).to.be.true
  })

  it('Should have the same homepage after a restart', async function () {
    this.timeout(30000)

    killallServers([ server ])

    await reRunServer(server)

    const res = await getInstanceHomepage(server.url)
    const page: CustomPage = res.body
    expect(page.content).to.equal('<picsou-magazine></picsou-magazine>')

    const state = await getHomepageState(server)
    expect(state).to.be.true
  })

  it('Should empty the homepage', async function () {
    await updateInstanceHomepage(server.url, server.accessToken, '')

    const res = await getInstanceHomepage(server.url)
    const page: CustomPage = res.body
    expect(page.content).to.be.empty

    const state = await getHomepageState(server)
    expect(state).to.be.false
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
