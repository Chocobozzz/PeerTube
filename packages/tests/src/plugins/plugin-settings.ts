/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test plugin settings', function () {
  let server: PeerTubeServer
  let command: PluginsCommand

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    command = server.plugins

    await command.install({
      path: PluginsCommand.getPluginTestPath()
    })
  })

  it('Should not have duplicate settings', async function () {
    const { registeredSettings } = await command.getRegisteredSettings({
      npmName: 'peertube-plugin-test'
    })

    expect(registeredSettings.length).to.equal(1)
  })

  it('Should return the latest registered settings', async function () {
    const { registeredSettings } = await command.getRegisteredSettings({
      npmName: 'peertube-plugin-test'
    })

    expect(registeredSettings[0].options.length).length.to.equal(1)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
