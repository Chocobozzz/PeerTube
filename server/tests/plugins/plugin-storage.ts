/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { pathExists, readdir, readFile } from 'fs-extra'
import { join } from 'path'
import { HttpStatusCode } from '@shared/core-utils'
import {
  buildServerDirectory,
  getPluginTestPath,
  installPlugin,
  makeGetRequest,
  setAccessTokensToServers,
  uninstallPlugin
} from '../../../shared/extra-utils'
import { cleanupTests, flushAndRunServer, ServerInfo, waitUntilLog } from '../../../shared/extra-utils/server/servers'

describe('Test plugin storage', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await installPlugin({
      url: server.url,
      accessToken: server.accessToken,
      path: getPluginTestPath('-six')
    })
  })

  describe('DB storage', function () {

    it('Should correctly store a subkey', async function () {
      await waitUntilLog(server, 'superkey stored value is toto')
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
      dataPath = buildServerDirectory(server, 'plugins/data')
      pluginDataPath = join(dataPath, 'peertube-plugin-test-six')
    })

    it('Should have created the directory on install', async function () {
      const dataPath = buildServerDirectory(server, 'plugins/data')
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
        statusCodeExpected: HttpStatusCode.OK_200
      })

      const content = await getFileContent()
      expect(content).to.equal('Prince Ali')
    })

    it('Should still have the file after an uninstallation', async function () {
      await uninstallPlugin({
        url: server.url,
        accessToken: server.accessToken,
        npmName: 'peertube-plugin-test-six'
      })

      const content = await getFileContent()
      expect(content).to.equal('Prince Ali')
    })

    it('Should still have the file after the reinstallation', async function () {
      await installPlugin({
        url: server.url,
        accessToken: server.accessToken,
        path: getPluginTestPath('-six')
      })

      const content = await getFileContent()
      expect(content).to.equal('Prince Ali')
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
