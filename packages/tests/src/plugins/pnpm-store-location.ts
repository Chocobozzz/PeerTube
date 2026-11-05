/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { execa } from 'execa'
import { remove } from 'fs-extra/esm'
import { tmpdir } from 'os'
import { join } from 'path'

describe('Test plugin installation when pnpm store changes', function () {
  let server: PeerTubeServer
  let firstStoreDir: string
  let secondStoreDir: string

  before(async function () {
    this.timeout(90000)

    const id = Date.now()
    firstStoreDir = join(tmpdir(), `peertube-plugin-store-a-${id}`)
    secondStoreDir = join(tmpdir(), `peertube-plugin-store-b-${id}`)

    server = await createSingleServer(1, undefined, {
      env: {
        npm_config_store_dir: firstStoreDir, // PNPM <= 10
        pnpm_config_store_dir: firstStoreDir // PNPM > 11
      }
    })

    await setAccessTokensToServers([ server ])
  })

  it('Should still install plugins if store location changed', async function () {
    this.timeout(90000)

    await server.plugins.install({ npmName: 'peertube-theme-dark' })

    await server.kill()

    await server.run(undefined, {
      env: {
        npm_config_store_dir: secondStoreDir, // PNPM <= 10
        pnpm_config_store_dir: secondStoreDir // PNPM > 11
      }
    })

    await setAccessTokensToServers([ server ])

    await server.plugins.install({ npmName: 'peertube-plugin-hello-world' })

    // PNPM < 12 throws ERR_PNPM_UNEXPECTED_STORE so PeerTube runs pnpm install and retries the command
    // PNPM >= 12 relinks the packages from the new store by itself
    const { stdout } = await execa('pnpm', [ '--version' ], { cwd: server.servers.buildDirectory('plugins') })
    if (parseInt(stdout.split('.')[0]) < 12) {
      await server.servers.waitUntilLog('Cannot exec pnpm because of an unexpected store location.')
    }

    for (const npmName of [ 'peertube-theme-dark', 'peertube-plugin-hello-world' ]) {
      const packageJSON = await server.plugins.getPackageJSON(npmName)

      expect(packageJSON.name).to.equal(npmName)
    }
  })

  after(async function () {
    await cleanupTests([ server ])

    await remove(firstStoreDir)
    await remove(secondStoreDir)
  })
})
