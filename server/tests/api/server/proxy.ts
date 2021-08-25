/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { cleanupTests, createMultipleServers, doubleFollow, PeerTubeServer, setAccessTokensToServers, waitJobs } from '@shared/extra-utils'
import { MockProxy } from '@shared/extra-utils/mock-servers/mock-proxy'

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
    await doubleFollow(servers[0], servers[1])
  })

  it('Should succeed federation with the appropriate proxy config', async function () {
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

  after(async function () {
    proxy.terminate()

    await cleanupTests(servers)
  })
})
