/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import { About } from '../../../../shared/models/server/about.model'
import { CustomConfig } from '../../../../shared/models/server/custom-config.model'
import {
  cleanupTests,
  deleteCustomConfig,
  flushAndRunServer,
  getAbout,
  getConfig,
  getCustomConfig, installPlugin,
  killallServers, parallelTests,
  registerUser,
  reRunServer, ServerInfo,
  setAccessTokensToServers,
  updateCustomConfig, uploadVideo
} from '../../../../shared/extra-utils'
import { ServerConfig } from '../../../../shared/models'
import { PeerTubePlugin } from '../../../../shared/models/plugins/peertube-plugin.model'

const expect = chai.expect

describe('Test plugins', function () {
  let server = null

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    {
      await installPlugin({ url: server.url, accessToken: server.accessToken, npmName: 'peertube-plugin-hello-world' })
    }

    {
      await installPlugin({ url: server.url, accessToken: server.accessToken, npmName: 'peertube-plugin-background-color' })
    }
  })

  it('Should list available plugins and themes', async function () {
    // List without filter
    // List with filter (plugin and theme)
  })

  it('Should search available plugins', async function () {
    // Search with filter (plugin and theme)
    // Add pagination
    // Add sort
    // Add peertube engine
  })

  it('Should have an empty global css', async function () {
    // get /global.css
  })

  it('Should install a plugin and a theme', async function () {

  })

  it('Should have the correct global css', async function () {
    // get /global.css
  })

  it('Should have the plugin loaded in the configuration', async function () {
    // Check registered themes/plugins
  })

  it('Should update the default theme in the configuration', async function () {
    // Update config
  })

  it('Should list plugins and themes', async function () {
    // List without filter
    // List with filter (theme/plugin)
    // List with pagination
    // List with sort
  })

  it('Should get a plugin and a theme', async function () {
    // Get plugin
    // Get theme
  })

  it('Should get registered settings', async function () {
    // Get plugin
  })

  it('Should update the settings', async function () {
    // Update /settings

    // get /plugin
  })

  it('Should update the plugin and the theme', async function () {
    // update BDD -> 0.0.1
    // update package.json (theme + plugin)
    // list to check versions
    // update plugin + theme
    // list to check they have been updated
    // check package.json are upgraded too
  })

  it('Should uninstall the plugin', async function () {
    // uninstall
    // list
  })

  it('Should have an empty global css', async function () {
    // get /global.css
  })

  it('Should list uninstalled plugins', async function () {
    // { uninstalled: true }
  })

  it('Should uninstall the theme', async function () {
    // Uninstall
  })

  it('Should have updated the configuration', async function () {
    // get /config (default theme + registered themes + registered plugins)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
