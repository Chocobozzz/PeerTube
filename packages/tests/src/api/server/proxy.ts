/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode, HttpStatusCodeType, VideoPrivacy } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { expectStartWith, expectNotStartWith } from '@tests/shared/checks.js'
import { MockProxy } from '@tests/shared/mock-servers/mock-proxy.js'

describe('Test proxy', function () {
  let servers: PeerTubeServer[] = []
  let proxy: MockProxy

  const goodEnv = { HTTP_PROXY: '' }
  const badEnv = { HTTP_PROXY: 'http://127.0.0.1:9000' }

  before(async function () {
    this.timeout(120000)

    proxy = new MockProxy()

    const proxyPort = await proxy.initialize()
    servers = await createMultipleServers(2)

    goodEnv.HTTP_PROXY = 'http://127.0.0.1:' + proxyPort

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

    function getProxyConfig (url: string) {
      return {
        import: {
          videos: {
            http: {
              proxies: url
                ? [ url ]
                : []
            }
          }
        }
      }
    }

    function quickImport (expectedStatus: HttpStatusCodeType = HttpStatusCode.OK_200) {
      return servers[0].videoImports.importVideo({
        attributes: {
          name: 'video import',
          channelId: servers[0].store.channel.id,
          privacy: VideoPrivacy.PUBLIC,
          targetUrl: FIXTURE_URLS.peertubeLong
        },
        expectedStatus
      })
    }

    it('Should succeed import with the appropriate proxy config', async function () {
      this.timeout(240000)

      await servers[0].kill()
      await servers[0].run({}, { env: goodEnv, autoEnableImportProxy: false })

      await quickImport()

      await waitJobs(servers)

      const { total, data } = await servers[0].videos.list()
      expect(total).to.equal(3)
      expect(data).to.have.lengthOf(3)
    })

    it('Should fail import with a wrong proxy config in env', async function () {
      this.timeout(120000)

      await servers[0].kill()
      await servers[0].run({}, { env: badEnv, autoEnableImportProxy: false })

      await quickImport(HttpStatusCode.BAD_REQUEST_400)
    })

    it('Should fail import with a wrong proxy config in config', async function () {
      this.timeout(120000)

      await servers[0].kill()
      await servers[0].run(getProxyConfig('http://localhost:9000'), { autoEnableImportProxy: false })

      await quickImport(HttpStatusCode.BAD_REQUEST_400)
    })
  })

  describe('Object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    before(async function () {
      this.timeout(30000)

      await objectStorage.prepareDefaultMockBuckets()
    })

    it('Should succeed to upload to object storage with the appropriate proxy config', async function () {
      this.timeout(120000)

      await servers[0].kill()
      await servers[0].run(objectStorage.getDefaultMockConfig(), { env: goodEnv })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })

      expectStartWith(video.files[0].fileUrl, objectStorage.getMockWebVideosBaseUrl())
    })

    it('Should fail to upload to object storage with a wrong proxy config', async function () {
      this.timeout(120000)

      await servers[0].kill()
      await servers[0].run(objectStorage.getDefaultMockConfig(), { env: badEnv })

      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
      await waitJobs(servers, { skipDelayed: true })

      const video = await servers[0].videos.get({ id: uuid })

      expectNotStartWith(video.files[0].fileUrl, objectStorage.getMockWebVideosBaseUrl())
    })

    after(async function () {
      await objectStorage.cleanupMock()
    })
  })

  after(async function () {
    await proxy.terminate()

    await cleanupTests(servers)
  })
})
