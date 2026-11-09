/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRole } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { MockCoreBlocklist } from '@tests/shared/mock-servers/mock-core-blocklist.js'
import { MockHTTP } from '@tests/shared/mock-servers/mock-http.js'
import { expect } from 'chai'

describe('Test SSRF requests', function () {
  let servers: PeerTubeServer[] = []

  let baseServerConfig: any

  let mockBlocklist: MockCoreBlocklist
  let blocklistUrl: string
  let moderatorToken: string

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

    mockBlocklist = new MockCoreBlocklist()
    blocklistUrl = `http://127.0.0.1:${await mockBlocklist.initialize()}`

    moderatorToken = await servers[0].users.generateUserAndToken('moderator', UserRole.MODERATOR)
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

    it('Should add a blocklist subscription on internal network as a moderator', async function () {
      await servers[0].blocklist.addServerBlocklistSubscription({ subscriptionUrl: blocklistUrl + '/list-2', token: moderatorToken })
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

    it('Should forbid a moderator to subscribe to a blocklist on internal network', async function () {
      await servers[0].blocklist.addServerBlocklistSubscription({
        subscriptionUrl: blocklistUrl + '/list.json',
        token: moderatorToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      expect(mockBlocklist.countRequests('/list.json')).to.equal(0)
    })

    it('Should allow an admin to subscribe to a blocklist on internal network', async function () {
      await servers[0].blocklist.addServerBlocklistSubscription({ subscriptionUrl: blocklistUrl + '/list.json' })

      expect(mockBlocklist.countRequests('/list.json')).to.equal(1)
    })

    it('Should only synchronize the internal blocklists added by admins', async function () {
      this.timeout(30000)

      const moderatorListRequests = mockBlocklist.countRequests('/list-2')

      await wait(8000)

      expect(mockBlocklist.countRequests('/list.json')).to.be.greaterThan(1)
      expect(mockBlocklist.countRequests('/list-2')).to.equal(moderatorListRequests)
    })
  })

  after(async function () {
    await mockBlocklist.terminate()
    await cleanupTests(servers)
  })
})
