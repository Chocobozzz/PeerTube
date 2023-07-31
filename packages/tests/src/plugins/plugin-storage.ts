/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { pathExists } from 'fs-extra/esm'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test plugin storage', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-six') })
  })

  describe('DB storage', function () {
    it('Should correctly store a subkey', async function () {
      await server.servers.waitUntilLog('superkey stored value is toto')
    })

    it('Should correctly retrieve an array as array from the storage.', async function () {
      await server.servers.waitUntilLog('storedArrayKey isArray is true')
      await server.servers.waitUntilLog('storedArrayKey stored value is toto, toto2')
    })
  })

  describe('Disk storage', function () {
    let dataPath: string
    let pluginDataPath: string

    async function getFileContent () {
      const files = await readdir(pluginDataPath)
      expect(files).to.have.lengthOf(1)

      return readFile(join(pluginDataPath, files[0]), 'utf8')
    }

    before(function () {
      dataPath = server.servers.buildDirectory('plugins/data')
      pluginDataPath = join(dataPath, 'peertube-plugin-test-six')
    })

    it('Should have created the directory on install', async function () {
      const dataPath = server.servers.buildDirectory('plugins/data')
      const pluginDataPath = join(dataPath, 'peertube-plugin-test-six')

      expect(await pathExists(dataPath)).to.be.true
      expect(await pathExists(pluginDataPath)).to.be.true
      expect(await readdir(pluginDataPath)).to.have.lengthOf(0)
    })

    it('Should have created a file', async function () {
      await makeGetRequest({
        url: server.url,
        token: server.accessToken,
        path: '/plugins/test-six/router/create-file',
        expectedStatus: HttpStatusCode.OK_200
      })

      const content = await getFileContent()
      expect(content).to.equal('Prince Ali')
    })

    it('Should still have the file after an uninstallation', async function () {
      await server.plugins.uninstall({ npmName: 'peertube-plugin-test-six' })

      const content = await getFileContent()
      expect(content).to.equal('Prince Ali')
    })

    it('Should still have the file after the reinstallation', async function () {
      await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-six') })

      const content = await getFileContent()
      expect(content).to.equal('Prince Ali')
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
