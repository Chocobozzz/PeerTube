/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { MockHTTP } from '@tests/shared/mock-servers/mock-http.js'
import { expect } from 'chai'

describe('Test SSRF requests', function () {
  let servers: PeerTubeServer[] = []

  let baseServerConfig: any

  before(async function () {
    this.timeout(240000)

    const mockHTTP = new MockHTTP()
    const port = await mockHTTP.initialize()

    baseServerConfig = {
      plugins: {
        index: {
          url: `http://127.0.0.1:${port}/redirect/https://packages.joinpeertube.org`
        }
      }
    }

    servers = await createMultipleServers(2, baseServerConfig)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])
  })

  describe('Disabled SSRF protection', function () {

    it('Should not forbid non-unicast federation', async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      await waitJobs(servers)

      await servers[1].videos.get({ id: uuid })
    })

    it('Should fetch plugin index', async function () {
      const { total } = await servers[0].plugins.listAvailable({ count: 10 })

      expect(total).to.be.at.least(15)
    })
  })

  describe('Enabled SSRF protection', function () {
    before(async function () {
      await servers[0].kill()

      await servers[0].run({
        ...baseServerConfig,

        federation: { prevent_ssrf: true }
      })
    })

    it('Should forbid non-unicast federation', async function () {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      await waitJobs(servers)

      await servers[1].videos.get({ id: uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should still allow plugin index search on internal network', async function () {
      const { total } = await servers[0].plugins.listAvailable({ count: 10 })

      expect(total).to.be.at.least(15)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
