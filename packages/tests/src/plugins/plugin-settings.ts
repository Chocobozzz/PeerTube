/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

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

    expect(registeredSettings.length).to.equal(5)
    expect(registeredSettings.map(r => r.label)).to.have.members([ 'Test setting', 'Unique setting', 'Radio setting', 'Unnamed 1', 'Unnamed 2' ])
  })

  it('Should return the latest registered settings', async function () {
    const { registeredSettings } = await command.getRegisteredSettings({
      npmName: 'peertube-plugin-test'
    })

    expect(registeredSettings.find(r => r.label === 'Unique setting').options.length).to.equal(1)
  })

  it('Should return input-radio settings with their options', async function () {
    const { registeredSettings } = await command.getRegisteredSettings({
      npmName: 'peertube-plugin-test'
    })

    const radio = registeredSettings.find(r => r.name === 'radio-setting')
    expect(radio.type).to.equal('input-radio')
    expect(radio.default).to.equal('second')
    expect(radio.options.map(o => o.value)).to.deep.equal([ 'first', 'second' ])
  })

  it('Should update an input-radio setting', async function () {
    await command.updateSettings({
      npmName: 'peertube-plugin-test',
      settings: { 'radio-setting': 'first' }
    })

    const { settings } = await command.get({ npmName: 'peertube-plugin-test' })
    expect(settings['radio-setting']).to.equal('first')
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
