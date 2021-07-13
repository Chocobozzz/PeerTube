/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { HttpStatusCode } from '@shared/core-utils'
import {
  cleanupTests,
  flushAndRunServer,
  getMyUserInformation,
  killallServers,
  PluginsCommand,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  testHelloWorldRegisteredSettings,
  updateMyUser,
  wait
} from '@shared/extra-utils'
import { PluginType, User } from '@shared/models'

const expect = chai.expect

describe('Test plugins', function () {
  let server: ServerInfo = null
  let command: PluginsCommand

  before(async function () {
    this.timeout(30000)

    const configOverride = {
      plugins: {
        index: { check_latest_versions_interval: '5 seconds' }
      }
    }
    server = await flushAndRunServer(1, configOverride)
    await setAccessTokensToServers([ server ])

    command = server.pluginsCommand
  })

  it('Should list and search available plugins and themes', async function () {
    this.timeout(30000)

    {
      const body = await command.listAvailable({
        count: 1,
        start: 0,
        pluginType: PluginType.THEME,
        search: 'background-red'
      })

      expect(body.total).to.be.at.least(1)
      expect(body.data).to.have.lengthOf(1)
    }

    {
      const body1 = await command.listAvailable({
        count: 2,
        start: 0,
        sort: 'npmName'
      })
      expect(body1.total).to.be.at.least(2)

      const data1 = body1.data
      expect(data1).to.have.lengthOf(2)

      const body2 = await command.listAvailable({
        count: 2,
        start: 0,
        sort: '-npmName'
      })
      expect(body2.total).to.be.at.least(2)

      const data2 = body2.data
      expect(data2).to.have.lengthOf(2)

      expect(data1[0].npmName).to.not.equal(data2[0].npmName)
    }

    {
      const body = await command.listAvailable({
        count: 10,
        start: 0,
        pluginType: PluginType.THEME,
        search: 'background-red',
        currentPeerTubeEngine: '1.0.0'
      })

      const p = body.data.find(p => p.npmName === 'peertube-theme-background-red')
      expect(p).to.be.undefined
    }
  })

  it('Should install a plugin and a theme', async function () {
    this.timeout(30000)

    await command.install({ npmName: 'peertube-plugin-hello-world' })
    await command.install({ npmName: 'peertube-theme-background-red' })
  })

  it('Should have the plugin loaded in the configuration', async function () {
    const config = await server.configCommand.getConfig()

    const theme = config.theme.registered.find(r => r.name === 'background-red')
    expect(theme).to.not.be.undefined

    const plugin = config.plugin.registered.find(r => r.name === 'hello-world')
    expect(plugin).to.not.be.undefined
  })

  it('Should update the default theme in the configuration', async function () {
    await server.configCommand.updateCustomSubConfig({
      newConfig: {
        theme: { default: 'background-red' }
      }
    })

    const config = await server.configCommand.getConfig()
    expect(config.theme.default).to.equal('background-red')
  })

  it('Should update my default theme', async function () {
    await updateMyUser({
      url: server.url,
      accessToken: server.accessToken,
      theme: 'background-red'
    })

    const res = await getMyUserInformation(server.url, server.accessToken)
    expect((res.body as User).theme).to.equal('background-red')
  })

  it('Should list plugins and themes', async function () {
    {
      const body = await command.list({
        count: 1,
        start: 0,
        pluginType: PluginType.THEME
      })
      expect(body.total).to.be.at.least(1)

      const data = body.data
      expect(data).to.have.lengthOf(1)
      expect(data[0].name).to.equal('background-red')
    }

    {
      const { data } = await command.list({
        count: 2,
        start: 0,
        sort: 'name'
      })

      expect(data[0].name).to.equal('background-red')
      expect(data[1].name).to.equal('hello-world')
    }

    {
      const body = await command.list({
        count: 2,
        start: 1,
        sort: 'name'
      })

      expect(body.data[0].name).to.equal('hello-world')
    }
  })

  it('Should get registered settings', async function () {
    await testHelloWorldRegisteredSettings(server)
  })

  it('Should get public settings', async function () {
    const body = await command.getPublicSettings({ npmName: 'peertube-plugin-hello-world' })
    const publicSettings = body.publicSettings

    expect(Object.keys(publicSettings)).to.have.lengthOf(1)
    expect(Object.keys(publicSettings)).to.deep.equal([ 'user-name' ])
    expect(publicSettings['user-name']).to.be.null
  })

  it('Should update the settings', async function () {
    const settings = {
      'admin-name': 'Cid'
    }

    await command.updateSettings({
      npmName: 'peertube-plugin-hello-world',
      settings
    })
  })

  it('Should have watched settings changes', async function () {
    this.timeout(10000)

    await server.serversCommand.waitUntilLog('Settings changed!')
  })

  it('Should get a plugin and a theme', async function () {
    {
      const plugin = await command.get({ npmName: 'peertube-plugin-hello-world' })

      expect(plugin.type).to.equal(PluginType.PLUGIN)
      expect(plugin.name).to.equal('hello-world')
      expect(plugin.description).to.exist
      expect(plugin.homepage).to.exist
      expect(plugin.uninstalled).to.be.false
      expect(plugin.enabled).to.be.true
      expect(plugin.description).to.exist
      expect(plugin.version).to.exist
      expect(plugin.peertubeEngine).to.exist
      expect(plugin.createdAt).to.exist

      expect(plugin.settings).to.not.be.undefined
      expect(plugin.settings['admin-name']).to.equal('Cid')
    }

    {
      const plugin = await command.get({ npmName: 'peertube-theme-background-red' })

      expect(plugin.type).to.equal(PluginType.THEME)
      expect(plugin.name).to.equal('background-red')
      expect(plugin.description).to.exist
      expect(plugin.homepage).to.exist
      expect(plugin.uninstalled).to.be.false
      expect(plugin.enabled).to.be.true
      expect(plugin.description).to.exist
      expect(plugin.version).to.exist
      expect(plugin.peertubeEngine).to.exist
      expect(plugin.createdAt).to.exist

      expect(plugin.settings).to.be.null
    }
  })

  it('Should update the plugin and the theme', async function () {
    this.timeout(90000)

    // Wait the scheduler that get the latest plugins versions
    await wait(6000)

    // Fake update our plugin version
    await server.sqlCommand.setPluginVersion('hello-world', '0.0.1')

    // Fake update package.json
    const packageJSON = await command.getPackageJSON('peertube-plugin-hello-world')
    const oldVersion = packageJSON.version

    packageJSON.version = '0.0.1'
    await command.updatePackageJSON('peertube-plugin-hello-world', packageJSON)

    // Restart the server to take into account this change
    await killallServers([ server ])
    await reRunServer(server)

    {
      const body = await command.list({ pluginType: PluginType.PLUGIN })

      const plugin = body.data[0]
      expect(plugin.version).to.equal('0.0.1')
      expect(plugin.latestVersion).to.exist
      expect(plugin.latestVersion).to.not.equal('0.0.1')
    }

    {
      await command.update({ npmName: 'peertube-plugin-hello-world' })

      const body = await command.list({ pluginType: PluginType.PLUGIN })

      const plugin = body.data[0]
      expect(plugin.version).to.equal(oldVersion)

      const updatedPackageJSON = await command.getPackageJSON('peertube-plugin-hello-world')
      expect(updatedPackageJSON.version).to.equal(oldVersion)
    }
  })

  it('Should uninstall the plugin', async function () {
    await command.uninstall({ npmName: 'peertube-plugin-hello-world' })

    const body = await command.list({ pluginType: PluginType.PLUGIN })
    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  it('Should list uninstalled plugins', async function () {
    const body = await command.list({ pluginType: PluginType.PLUGIN, uninstalled: true })
    expect(body.total).to.equal(1)
    expect(body.data).to.have.lengthOf(1)

    const plugin = body.data[0]
    expect(plugin.name).to.equal('hello-world')
    expect(plugin.enabled).to.be.false
    expect(plugin.uninstalled).to.be.true
  })

  it('Should uninstall the theme', async function () {
    await command.uninstall({ npmName: 'peertube-theme-background-red' })
  })

  it('Should have updated the configuration', async function () {
    const config = await server.configCommand.getConfig()

    expect(config.theme.default).to.equal('default')

    const theme = config.theme.registered.find(r => r.name === 'background-red')
    expect(theme).to.be.undefined

    const plugin = config.plugin.registered.find(r => r.name === 'hello-world')
    expect(plugin).to.be.undefined
  })

  it('Should have updated the user theme', async function () {
    const res = await getMyUserInformation(server.url, server.accessToken)
    expect((res.body as User).theme).to.equal('instance-default')
  })

  it('Should not install a broken plugin', async function () {
    this.timeout(60000)

    async function check () {
      const body = await command.list({ pluginType: PluginType.PLUGIN })
      const plugins = body.data
      expect(plugins.find(p => p.name === 'test-broken')).to.not.exist
    }

    await command.install({
      path: PluginsCommand.getPluginTestPath('-broken'),
      expectedStatus: HttpStatusCode.BAD_REQUEST_400
    })

    await check()

    await killallServers([ server ])
    await reRunServer(server)

    await check()
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
