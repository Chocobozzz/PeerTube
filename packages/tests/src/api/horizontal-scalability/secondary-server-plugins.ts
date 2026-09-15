/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { pathExists, readJSON } from 'fs-extra/esm'
import { join } from 'path'

describe('Test plugins of a secondary server process', function () {
  let primary: PeerTubeServer
  let secondary: PeerTubeServer
  let videoUUID: string

  const npmName = 'peertube-plugin-test-secondary'
  const pluginPath = PluginsCommand.getPluginTestPath('-secondary')

  // The secondary owns its plugin directory instead of sharing the one of the primary
  function secondaryPluginPath (name: string) {
    return join(primary.getDirectoryPath('plugins-secondary'), 'node_modules', name)
  }

  before(async function () {
    this.timeout(120000)

    primary = await createSingleServer(1)

    await setAccessTokensToServers([ primary ])
    await setDefaultVideoChannel([ primary ])

    const { uuid } = await primary.videos.quickUpload({ name: 'video served by both processes' })
    videoUUID = uuid
  })

  describe('Synchronization at boot', function () {
    it('Should install in its own directory the plugins the primary recorded', async function () {
      this.timeout(120000)

      await primary.plugins.install({ path: pluginPath })

      secondary = await createSecondaryServer(primary)

      expect(await pathExists(secondaryPluginPath(npmName))).to.be.true
    })

    it('Should run the hooks of that plugin like the primary does', async function () {
      const fromPrimary = await primary.videos.get({ id: videoUUID })
      const fromSecondary = await secondary.videos.get({ id: videoUUID })

      expect(fromPrimary.name.endsWith(' <3'), 'the primary should run the plugin hook').to.be.true
      expect(fromSecondary.name).to.equal(fromPrimary.name)

      const primaryList = await primary.videos.list()
      const secondaryList = await secondary.videos.list()

      expect(secondaryList.total).to.equal(primaryList.total)
    })
  })

  describe('Synchronization at runtime', function () {
    it('Should install on the secondary a plugin installed on the primary', async function () {
      this.timeout(120000)

      expect(await pathExists(secondaryPluginPath('peertube-plugin-hello-world'))).to.be.false

      // An old version, so the upgrade test below has something to upgrade to
      await primary.plugins.install({ npmName: 'peertube-plugin-hello-world', pluginVersion: '0.0.17' })

      await secondary.servers.waitUntilLog('Installed plugin peertube-plugin-hello-world@0.0.17 to match the database')

      const installed = await readJSON(join(secondaryPluginPath('peertube-plugin-hello-world'), 'package.json'))
      expect(installed.version).to.equal('0.0.17')
    })

    it('Should run the settings change callbacks of the plugin', async function () {
      this.timeout(60000)

      await primary.plugins.updateSettings({
        npmName,
        settings: { suffix: '<4' }
      })

      await secondary.servers.waitUntilLog('Secondary test plugin settings changed, suffix is now <4')

      const { name } = await secondary.videos.get({ id: videoUUID })
      expect(name.endsWith(' <4'), 'the secondary should use the new setting').to.be.true
    })

    it('Should upgrade on the secondary a plugin the primary upgraded', async function () {
      this.timeout(120000)

      await primary.plugins.update({ npmName: 'peertube-plugin-hello-world' })

      const { version } = await primary.plugins.get({ npmName: 'peertube-plugin-hello-world' })
      expect(version).to.not.equal('0.0.17')

      await secondary.servers.waitUntilLog(`Installed plugin peertube-plugin-hello-world@${version} to match the database`)

      const installed = await readJSON(join(secondaryPluginPath('peertube-plugin-hello-world'), 'package.json'))
      expect(installed.version).to.equal(version)
    })

    it('Should uninstall on the secondary a plugin uninstalled on the primary', async function () {
      this.timeout(120000)

      await primary.plugins.uninstall({ npmName: 'peertube-plugin-hello-world' })

      await secondary.servers.waitUntilLog('Removed plugin peertube-plugin-hello-world')

      expect(await pathExists(secondaryPluginPath('peertube-plugin-hello-world'))).to.be.false

      // The one the primary still lists is untouched
      expect(await pathExists(secondaryPluginPath(npmName))).to.be.true
    })

    it('Should stop running the hooks of an uninstalled plugin', async function () {
      this.timeout(120000)

      await primary.plugins.uninstall({ npmName })

      await secondary.servers.waitUntilLog('Removed plugin ' + npmName)

      const { name } = await secondary.videos.get({ id: videoUUID })
      expect(name).to.not.contain('<4')
    })
  })

  // Must stay last: it stops the secondary of the previous tests
  describe('Divergence from the primary', function () {
    const failingNpmName = 'peertube-plugin-test-secondary-failure'

    async function waitUntilStopped (server: PeerTubeServer) {
      while (true) {
        try {
          await makeGetRequest({ url: server.url, path: '/api/v1/ping', expectedStatus: null })
        } catch {
          return
        }

        await wait(500)
      }
    }

    it('Should stop a running secondary that cannot register a plugin the primary installed', async function () {
      this.timeout(120000)

      await primary.plugins.install({ path: PluginsCommand.getPluginTestPath('-secondary-failure') })

      await secondary.servers.waitUntilLog(`failed to register ${failingNpmName}, which the primary process runs`)
      await waitUntilStopped(secondary)
    })

    it('Should refuse to boot a secondary that cannot register a plugin the primary runs', async function () {
      this.timeout(120000)

      let started: PeerTubeServer
      let error: Error

      try {
        started = await createSecondaryServer(primary)
      } catch (err) {
        error = err as Error
      }

      if (started) await started.kill()

      expect(error, 'the secondary process should not have started').to.exist
      expect(error.message).to.contain(`failed to register ${failingNpmName}, which the primary process runs`)
    })

    it('Should boot a secondary once the primary does not run that plugin anymore', async function () {
      this.timeout(120000)

      await primary.plugins.uninstall({ npmName: failingNpmName })

      secondary = await createSecondaryServer(primary)

      await makeGetRequest({ url: secondary.url, path: '/api/v1/ping', expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  after(async function () {
    await cleanupTests([ secondary, primary ])
  })
})
