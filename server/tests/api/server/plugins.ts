/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  closeAllSequelize,
  flushAndRunServer,
  getConfig,
  getMyUserInformation,
  getPlugin,
  getPluginPackageJSON,
  getPluginRegisteredSettings,
  getPluginsCSS,
  getPublicSettings,
  installPlugin,
  killallServers,
  listAvailablePlugins,
  listPlugins,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  setPluginVersion,
  uninstallPlugin,
  updateCustomSubConfig,
  updateMyUser,
  updatePlugin,
  updatePluginPackageJSON,
  updatePluginSettings,
  wait,
  waitUntilLog
} from '../../../../shared/extra-utils'
import { PluginType } from '../../../../shared/models/plugins/plugin.type'
import { PeerTubePluginIndex } from '../../../../shared/models/plugins/peertube-plugin-index.model'
import { ServerConfig } from '../../../../shared/models/server'
import { PeerTubePlugin } from '../../../../shared/models/plugins/peertube-plugin.model'
import { User } from '../../../../shared/models/users'
import { PluginPackageJson } from '../../../../shared/models/plugins/plugin-package-json.model'
import { RegisteredServerSettings } from '../../../../shared/models/plugins/register-server-setting.model'
import { PublicServerSetting } from '../../../../shared/models/plugins/public-server.setting'

const expect = chai.expect

describe('Test plugins', function () {
  let server: ServerInfo = null

  before(async function () {
    this.timeout(30000)

    const configOverride = {
      plugins: {
        index: { check_latest_versions_interval: '5 seconds' }
      }
    }
    server = await flushAndRunServer(1, configOverride)
    await setAccessTokensToServers([ server ])
  })

  it('Should list and search available plugins and themes', async function () {
    this.timeout(30000)

    {
      const res = await listAvailablePlugins({
        url: server.url,
        accessToken: server.accessToken,
        count: 1,
        start: 0,
        pluginType: PluginType.THEME,
        search: 'background-red'
      })

      expect(res.body.total).to.be.at.least(1)
      expect(res.body.data).to.have.lengthOf(1)
    }

    {
      const res1 = await listAvailablePlugins({
        url: server.url,
        accessToken: server.accessToken,
        count: 2,
        start: 0,
        sort: 'npmName'
      })
      const data1: PeerTubePluginIndex[] = res1.body.data

      expect(res1.body.total).to.be.at.least(2)
      expect(data1).to.have.lengthOf(2)

      const res2 = await listAvailablePlugins({
        url: server.url,
        accessToken: server.accessToken,
        count: 2,
        start: 0,
        sort: '-npmName'
      })
      const data2: PeerTubePluginIndex[] = res2.body.data

      expect(res2.body.total).to.be.at.least(2)
      expect(data2).to.have.lengthOf(2)

      expect(data1[0].npmName).to.not.equal(data2[0].npmName)
    }

    {
      const res = await listAvailablePlugins({
        url: server.url,
        accessToken: server.accessToken,
        count: 10,
        start: 0,
        pluginType: PluginType.THEME,
        search: 'background-red',
        currentPeerTubeEngine: '1.0.0'
      })
      const data: PeerTubePluginIndex[] = res.body.data

      const p = data.find(p => p.npmName === 'peertube-theme-background-red')
      expect(p).to.be.undefined
    }
  })

  it('Should have an empty global css', async function () {
    const res = await getPluginsCSS(server.url)

    expect(res.text).to.be.empty
  })

  it('Should install a plugin and a theme', async function () {
    this.timeout(30000)

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-hello-world'
    })

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-theme-background-red'
    })
  })

  it('Should have the correct global css', async function () {
    const res = await getPluginsCSS(server.url)

    expect(res.text).to.contain('background-color: red')
  })

  it('Should have the plugin loaded in the configuration', async function () {
    const res = await getConfig(server.url)
    const config: ServerConfig = res.body

    const theme = config.theme.registered.find(r => r.name === 'background-red')
    expect(theme).to.not.be.undefined

    const plugin = config.plugin.registered.find(r => r.name === 'hello-world')
    expect(plugin).to.not.be.undefined
  })

  it('Should update the default theme in the configuration', async function () {
    await updateCustomSubConfig(server.url, server.accessToken, { theme: { default: 'background-red' } })

    const res = await getConfig(server.url)
    const config: ServerConfig = res.body

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
      const res = await listPlugins({
        url: server.url,
        accessToken: server.accessToken,
        count: 1,
        start: 0,
        pluginType: PluginType.THEME
      })
      const data: PeerTubePlugin[] = res.body.data

      expect(res.body.total).to.be.at.least(1)
      expect(data).to.have.lengthOf(1)
      expect(data[0].name).to.equal('background-red')
    }

    {
      const res = await listPlugins({
        url: server.url,
        accessToken: server.accessToken,
        count: 2,
        start: 0,
        sort: 'name'
      })
      const data: PeerTubePlugin[] = res.body.data

      expect(data[0].name).to.equal('background-red')
      expect(data[1].name).to.equal('hello-world')
    }

    {
      const res = await listPlugins({
        url: server.url,
        accessToken: server.accessToken,
        count: 2,
        start: 1,
        sort: 'name'
      })
      const data: PeerTubePlugin[] = res.body.data

      expect(data[0].name).to.equal('hello-world')
    }
  })

  it('Should get registered settings', async function () {
    const res = await getPluginRegisteredSettings({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-hello-world'
    })

    const registeredSettings = (res.body as RegisteredServerSettings).registeredSettings

    expect(registeredSettings).to.have.length.at.least(1)

    const adminNameSettings = registeredSettings.find(s => s.name === 'admin-name')
    expect(adminNameSettings).to.not.be.undefined
  })

  it('Should get public settings', async function () {
    const res = await getPublicSettings({ url: server.url, npmName: 'peertube-plugin-hello-world' })

    const publicSettings = (res.body as PublicServerSetting).publicSettings

    expect(Object.keys(publicSettings)).to.have.lengthOf(1)
    expect(Object.keys(publicSettings)).to.deep.equal([ 'user-name' ])
    expect(publicSettings['user-name']).to.be.null
  })

  it('Should update the settings', async function () {
    const settings = {
      'admin-name': 'Cid'
    }

    await updatePluginSettings({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-hello-world',
      settings
    })
  })

  it('Should have watched settings changes', async function () {
    this.timeout(10000)

    await waitUntilLog(server, 'Settings changed!')
  })

  it('Should get a plugin and a theme', async function () {
    {
      const res = await getPlugin({
        url: server.url,
        accessToken: server.accessToken,
        npmName: 'peertube-plugin-hello-world'
      })

      const plugin: PeerTubePlugin = res.body

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
      const res = await getPlugin({
        url: server.url,
        accessToken: server.accessToken,
        npmName: 'peertube-theme-background-red'
      })

      const plugin: PeerTubePlugin = res.body

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
    this.timeout(30000)

    // Wait the scheduler that get the latest plugins versions
    await wait(6000)

    // Fake update our plugin version
    await setPluginVersion(server.internalServerNumber, 'hello-world', '0.0.1')

    // Fake update package.json
    const packageJSON: PluginPackageJson = await getPluginPackageJSON(server, 'peertube-plugin-hello-world')
    const oldVersion = packageJSON.version

    packageJSON.version = '0.0.1'
    await updatePluginPackageJSON(server, 'peertube-plugin-hello-world', packageJSON)

    // Restart the server to take into account this change
    killallServers([ server ])
    await reRunServer(server)

    {
      const res = await listPlugins({
        url: server.url,
        accessToken: server.accessToken,
        pluginType: PluginType.PLUGIN
      })

      const plugin: PeerTubePlugin = res.body.data[0]

      expect(plugin.version).to.equal('0.0.1')
      expect(plugin.latestVersion).to.exist
      expect(plugin.latestVersion).to.not.equal('0.0.1')
    }

    {
      await updatePlugin({
        url: server.url,
        accessToken: server.accessToken,
        npmName: 'peertube-plugin-hello-world'
      })

      const res = await listPlugins({
        url: server.url,
        accessToken: server.accessToken,
        pluginType: PluginType.PLUGIN
      })

      const plugin: PeerTubePlugin = res.body.data[0]

      expect(plugin.version).to.equal(oldVersion)

      const updatedPackageJSON: PluginPackageJson = await getPluginPackageJSON(server, 'peertube-plugin-hello-world')
      expect(updatedPackageJSON.version).to.equal(oldVersion)
    }
  })

  it('Should uninstall the plugin', async function () {
    await uninstallPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-plugin-hello-world'
    })

    const res = await listPlugins({
      url: server.url,
      accessToken: server.accessToken,
      pluginType: PluginType.PLUGIN
    })

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should have an empty global css', async function () {
    const res = await getPluginsCSS(server.url)

    expect(res.text).to.be.empty
  })

  it('Should list uninstalled plugins', async function () {
    const res = await listPlugins({
      url: server.url,
      accessToken: server.accessToken,
      pluginType: PluginType.PLUGIN,
      uninstalled: true
    })

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.have.lengthOf(1)

    const plugin: PeerTubePlugin = res.body.data[0]
    expect(plugin.name).to.equal('hello-world')
    expect(plugin.enabled).to.be.false
    expect(plugin.uninstalled).to.be.true
  })

  it('Should uninstall the theme', async function () {
    await uninstallPlugin({
      url: server.url,
      accessToken: server.accessToken,
      npmName: 'peertube-theme-background-red'
    })
  })

  it('Should have updated the configuration', async function () {
    // get /config (default theme + registered themes + registered plugins)
    const res = await getConfig(server.url)
    const config: ServerConfig = res.body

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

  after(async function () {
    await closeAllSequelize([ server ])
    await cleanupTests([ server ])
  })
})
