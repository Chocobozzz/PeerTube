/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { FIXTURE_URLS, MockProxy } from '@server/tests/shared'
import { HttpStatusCode, VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'

const expect = chai.expect

describe('Test proxy', function () {
  let servers: PeerTubeServer[] = []
  let proxy: MockProxy

  const goodEnv = { HTTP_PROXY: '' }
  const badEnv = { HTTP_PROXY: 'http://localhost:9000' }

  before(async function () {
    this.timeout(120000)

    proxy = new MockProxy()

    const proxyPort = await proxy.initialize()
    servers = await createMultipleServers(2)

    goodEnv.HTTP_PROXY = 'http://localhost:' + proxyPort

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])
  })

  describe('Federation', function () {

    it('Should succeed federation with the appropriate proxy config', async function () {
      this.timeout(40000)

      await servers[0].kill()
      await servers[0].run({}, { env: goodEnv })

      await servers[0].videos.quickUpload({ name: 'video 1' })

      await waitJobs(servers)

      for (const server of servers) {
        const { total, data } = await server.videos.list()
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      }
    })

    it('Should fail federation with a wrong proxy config', async function () {
      this.timeout(40000)

      await servers[0].kill()
      await servers[0].run({}, { env: badEnv })

      await servers[0].videos.quickUpload({ name: 'video 2' })

      await waitJobs(servers)

      {
        const { total, data } = await servers[0].videos.list()
        expect(total).to.equal(2)
        expect(data).to.have.lengthOf(2)
      }

      {
        const { total, data } = await servers[1].videos.list()
        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
      }
    })
  })

  describe('Videos import', async function () {

    function quickImport (expectedStatus: HttpStatusCode = HttpStatusCode.OK_200) {
      return servers[0].imports.importVideo({
        attributes: {
          name: 'video import',
          channelId: servers[0].store.channel.id,
          privacy: VideoPrivacy.PUBLIC,
          targetUrl: FIXTURE_URLS.peertube_long
        },
        expectedStatus
      })
    }

    it('Should succeed import with the appropriate proxy config', async function () {
      this.timeout(40000)

      await servers[0].kill()
      await servers[0].run({}, { env: goodEnv })

      await quickImport()

      await waitJobs(servers)

      const { total, data } = await servers[0].videos.list()
      expect(total).to.equal(3)
      expect(data).to.have.lengthOf(3)
    })

    it('Should fail import with a wrong proxy config', async function () {
      this.timeout(40000)

      await servers[0].kill()
      await servers[0].run({}, { env: badEnv })

      await quickImport(HttpStatusCode.BAD_REQUEST_400)
    })
  })

  after(async function () {
    await proxy.terminate()

    await cleanupTests(servers)
  })
})
