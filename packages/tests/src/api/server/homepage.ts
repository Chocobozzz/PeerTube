/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  CustomPagesCommand,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultChannelAvatar
} from '@peertube/peertube-server-commands'

async function getHomepageState (server: PeerTubeServer) {
  const config = await server.config.getConfig()

  return config.homepage.enabled
}

describe('Test instance homepage actions', function () {
  let server: PeerTubeServer
  let command: CustomPagesCommand

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultChannelAvatar(server)
    await setDefaultAccountAvatar(server)

    command = server.customPage
  })

  it('Should not have a homepage', async function () {
    const state = await getHomepageState(server)
    expect(state).to.be.false

    await command.getInstanceHomepage({ expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should set a homepage', async function () {
    await command.updateInstanceHomepage({ content: '<picsou-magazine></picsou-magazine>' })

    const page = await command.getInstanceHomepage()
    expect(page.content).to.equal('<picsou-magazine></picsou-magazine>')

    const state = await getHomepageState(server)
    expect(state).to.be.true
  })

  it('Should have the same homepage after a restart', async function () {
    this.timeout(30000)

    await killallServers([ server ])

    await server.run()

    const page = await command.getInstanceHomepage()
    expect(page.content).to.equal('<picsou-magazine></picsou-magazine>')

    const state = await getHomepageState(server)
    expect(state).to.be.true
  })

  it('Should empty the homepage', async function () {
    await command.updateInstanceHomepage({ content: '' })

    const page = await command.getInstanceHomepage()
    expect(page.content).to.be.empty

    const state = await getHomepageState(server)
    expect(state).to.be.false
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
