/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import {
  cleanupTests,
  execCLI,
  flushAndRunServer,
  getConfig,
  getEnvCli,
  getPluginTestPath,
  killallServers,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers
} from '../../../shared/extra-utils'
import { ServerConfig } from '../../../shared/models/server'
import { expect } from 'chai'

describe('Test plugin scripts', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should install a plugin from stateless CLI', async function () {
    this.timeout(60000)

    const packagePath = getPluginTestPath()

    const env = getEnvCli(server)
    await execCLI(`${env} npm run plugin:install -- --plugin-path ${packagePath}`)
  })

  it('Should install a theme from stateless CLI', async function () {
    this.timeout(60000)

    const env = getEnvCli(server)
    await execCLI(`${env} npm run plugin:install -- --npm-name peertube-theme-background-red`)
  })

  it('Should have the theme and the plugin registered when we restart peertube', async function () {
    this.timeout(30000)

    killallServers([ server ])
    await reRunServer(server)

    const res = await getConfig(server.url)
    const config: ServerConfig = res.body

    const plugin = config.plugin.registered
                         .find(p => p.name === 'test')
    expect(plugin).to.not.be.undefined

    const theme = config.theme.registered
                        .find(t => t.name === 'background-red')
    expect(theme).to.not.be.undefined
  })

  it('Should uninstall a plugin from stateless CLI', async function () {
    this.timeout(60000)

    const env = getEnvCli(server)
    await execCLI(`${env} npm run plugin:uninstall -- --npm-name peertube-plugin-test`)
  })

  it('Should have removed the plugin on another peertube restart', async function () {
    this.timeout(30000)

    killallServers([ server ])
    await reRunServer(server)

    const res = await getConfig(server.url)
    const config: ServerConfig = res.body

    const plugin = config.plugin.registered
                         .find(p => p.name === 'test')
    expect(plugin).to.be.undefined
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
