/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists, remove } from 'fs-extra/esm'
import { join } from 'path'
import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, PluginType } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  makeGetRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { testHelloWorldRegisteredSettings } from '@tests/shared/plugins.js'

describe('Test plugins', function () {
  let server: PeerTubeServer
  let sqlCommand: SQLCommand
  let command: PluginsCommand

  before(async function () {
    this.timeout(30000)

    const configOverride = {
      plugins: {
        index: { check_latest_versions_interval: '5 seconds' }
      }
    }
    server = await createSingleServer(1, configOverride)
    await setAccessTokensToServers([ server ])

    command = server.plugins

    sqlCommand = new SQLCommand(server)
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
    for (const config of [ await server.config.getConfig(), await server.config.getIndexHTMLConfig() ]) {
      const theme = config.theme.registered.find(r => r.name === 'background-red')
      expect(theme).to.not.be.undefined
      expect(theme.npmName).to.equal('peertube-theme-background-red')

      const plugin = config.plugin.registered.find(r => r.name === 'hello-world')
      expect(plugin).to.not.be.undefined
      expect(plugin.npmName).to.equal('peertube-plugin-hello-world')
    }
  })

  it('Should update the default theme in the configuration', async function () {
    await server.config.updateExistingConfig({
      newConfig: {
        theme: { default: 'background-red' }
      }
    })

    for (const config of [ await server.config.getConfig(), await server.config.getIndexHTMLConfig() ]) {
      expect(config.theme.default).to.equal('background-red')
    }
  })

  it('Should update my default theme', async function () {
    await server.users.updateMe({ theme: 'background-red' })

    const user = await server.users.getMyInfo()
    expect(user.theme).to.equal('background-red')
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
    await server.servers.waitUntilLog('Settings changed!')
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
    this.timeout(180000)

    // Wait the scheduler that get the latest plugins versions
    await wait(6000)

    async function testUpdate (type: 'plugin' | 'theme', name: string) {
      // Fake update our plugin version
      await sqlCommand.setPluginVersion(name, '0.0.1')

      // Fake update package.json
      const packageJSON = await command.getPackageJSON(`peertube-${type}-${name}`)
      const oldVersion = packageJSON.version

      packageJSON.version = '0.0.1'
      await command.updatePackageJSON(`peertube-${type}-${name}`, packageJSON)

      // Restart the server to take into account this change
      await killallServers([ server ])
      await server.run()

      const checkConfig = async (version: string) => {
        for (const config of [ await server.config.getConfig(), await server.config.getIndexHTMLConfig() ]) {
          expect(config[type].registered.find(r => r.name === name).version).to.equal(version)
        }
      }

      const getPluginFromAPI = async () => {
        const body = await command.list({ pluginType: type === 'plugin' ? PluginType.PLUGIN : PluginType.THEME })

        return body.data.find(p => p.name === name)
      }

      {
        const plugin = await getPluginFromAPI()
        expect(plugin.version).to.equal('0.0.1')
        expect(plugin.latestVersion).to.exist
        expect(plugin.latestVersion).to.not.equal('0.0.1')

        await checkConfig('0.0.1')
      }

      {
        await command.update({ npmName: `peertube-${type}-${name}` })

        const plugin = await getPluginFromAPI()
        expect(plugin.version).to.equal(oldVersion)

        const updatedPackageJSON = await command.getPackageJSON(`peertube-${type}-${name}`)
        expect(updatedPackageJSON.version).to.equal(oldVersion)

        await checkConfig(oldVersion)
      }
    }

    await testUpdate('theme', 'background-red')
    await testUpdate('plugin', 'hello-world')
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
    for (const config of [ await server.config.getConfig(), await server.config.getIndexHTMLConfig() ]) {
      expect(config.theme.default).to.equal('default')

      const theme = config.theme.registered.find(r => r.name === 'background-red')
      expect(theme).to.be.undefined

      const plugin = config.plugin.registered.find(r => r.name === 'hello-world')
      expect(plugin).to.be.undefined
    }
  })

  it('Should have updated the user theme', async function () {
    const user = await server.users.getMyInfo()
    expect(user.theme).to.equal('instance-default')
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
    await server.run()

    await check()
  })

  it('Should rebuild native modules on Node ABI change', async function () {
    this.timeout(60000)

    const removeNativeModule = async () => {
      await remove(join(baseNativeModule, 'build'))
      await remove(join(baseNativeModule, 'prebuilds'))
    }

    await command.install({ path: PluginsCommand.getPluginTestPath('-native') })

    await makeGetRequest({
      url: server.url,
      path: '/plugins/test-native/router',
      expectedStatus: HttpStatusCode.NO_CONTENT_204
    })

    const query = `UPDATE "application" SET "nodeABIVersion" = 1`
    await sqlCommand.updateQuery(query)

    const baseNativeModule = server.servers.buildDirectory(join('plugins', 'node_modules', 'a-native-example'))

    await removeNativeModule()
    await server.kill()
    await server.run()

    await wait(3000)

    expect(await pathExists(join(baseNativeModule, 'build'))).to.be.true
    expect(await pathExists(join(baseNativeModule, 'prebuilds'))).to.be.true

    await makeGetRequest({
      url: server.url,
      path: '/plugins/test-native/router',
      expectedStatus: HttpStatusCode.NO_CONTENT_204
    })

    await removeNativeModule()

    await server.kill()
    await server.run()

    expect(await pathExists(join(baseNativeModule, 'build'))).to.be.false
    expect(await pathExists(join(baseNativeModule, 'prebuilds'))).to.be.false

    await makeGetRequest({
      url: server.url,
      path: '/plugins/test-native/router',
      expectedStatus: HttpStatusCode.NOT_FOUND_404
    })
  })

  after(async function () {
    await sqlCommand.cleanup()

    await cleanupTests([ server ])
  })
})
