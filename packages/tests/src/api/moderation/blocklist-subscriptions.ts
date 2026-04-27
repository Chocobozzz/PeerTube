/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import {
  cleanupTests,
  createSingleServer,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { MockCoreBlocklist } from '@tests/shared/mock-servers/mock-core-blocklist.js'
import { expect } from 'chai'

describe('Test blocklist subscriptions', function () {
  let server: PeerTubeServer
  let mockServer: MockCoreBlocklist
  let mockPort: number
  let subscriptionId: number

  before(async function () {
    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    mockServer = new MockCoreBlocklist()
    mockPort = await mockServer.initialize()
  })

  describe('When managing subscription endpoints', function () {
    it('Should add subscriptions', async function () {
      {
        const body = await server.blocklist.addServerBlocklistSubscription({ subscriptionUrl: `http://127.0.0.1:${mockPort}/list.json` })

        expect(body.name).to.equal('Test subscription')
        expect(body.url).to.equal(`http://127.0.0.1:${mockPort}/list.json`)

        subscriptionId = body.id
      }

      {
        const body = await server.blocklist.addServerBlocklistSubscription({ subscriptionUrl: `http://127.0.0.1:${mockPort}/list-2` })

        expect(body.name).to.equal('another subscription list')
        expect(body.url).to.equal(`http://127.0.0.1:${mockPort}/list-2`)
      }
    })

    it('Should list subscriptions', async function () {
      const body = await server.blocklist.listServerBlocklistSubscriptions({ sort: 'createdAt' })

      expect(body.total).to.equal(2)
      expect(body.data).to.have.lengthOf(2)

      {
        const subscription = body.data[0]
        expect(subscription.name).to.equal('Test subscription')
        expect(subscription.url).to.equal(`http://127.0.0.1:${mockPort}/list.json`)
        expect(subscription.mutedAccountsCount).to.equal(0)
        expect(subscription.mutedServersCount).to.equal(0)
        expect(subscription.createdAt).to.exist
        expect(subscription.updatedAt).to.exist
        expect(subscription.lastSyncAt).to.be.null
      }

      {
        const subscription = body.data[1]
        expect(subscription.name).to.equal('another subscription list')
        expect(subscription.url).to.equal(`http://127.0.0.1:${mockPort}/list-2`)
        expect(subscription.mutedAccountsCount).to.equal(0)
        expect(subscription.mutedServersCount).to.equal(0)
      }
    })

    it('Should search subscriptions', async function () {
      const body = await server.blocklist.listServerBlocklistSubscriptions({ search: 'another' })

      expect(body.total).to.equal(1)
      expect(body.data).to.have.lengthOf(1)

      const subscription = body.data[0]
      expect(subscription.name).to.equal('another subscription list')
    })

    it('Should sort and paginate subscriptions', async function () {
      {
        const body = await server.blocklist.listServerBlocklistSubscriptions({ sort: 'name' })

        expect(body.total).to.equal(2)
        expect(body.data).to.have.lengthOf(2)

        expect(body.data.map(d => d.name)).to.deep.equal([ 'another subscription list', 'Test subscription' ])
      }

      {
        const body = await server.blocklist.listServerBlocklistSubscriptions({ sort: '-name' })

        expect(body.total).to.equal(2)
        expect(body.data).to.have.lengthOf(2)

        expect(body.data.map(d => d.name)).to.deep.equal([ 'Test subscription', 'another subscription list' ])
      }

      {
        const body = await server.blocklist.listServerBlocklistSubscriptions({ start: 1, count: 1, sort: '-name' })

        expect(body.total).to.equal(2)
        expect(body.data).to.have.lengthOf(1)

        expect(body.data[0].name).to.equal('another subscription list')
      }
    })
  })

  describe('When synchronizing a subscription', function () {
    let server2: PeerTubeServer
    let mutedHandle1: string
    let mutedHandle2: string
    const mutedHost = 'example.com'

    before(async function () {
      server2 = await createSingleServer(2)
      await setAccessTokensToServers([ server2 ])

      const tokenMuted1 = await server.users.generateUserAndToken('muted1')
      const tokenMuted2 = await server.users.generateUserAndToken('muted2')

      mutedHandle1 = `muted1@${server.host}`
      mutedHandle2 = `muted2@${server.host}`

      await server.videos.quickUpload({ name: 'muted video', token: tokenMuted1 })
      await server.videos.quickUpload({ name: 'muted video', token: tokenMuted2 })

      await doubleFollow(server, server2)
    })

    it('Should automatically block and unblock from subscription actions', async function () {
      this.timeout(120_000)

      const now = Date.now()

      mockServer.setActions([
        { type: 'block', target: mutedHost, createdAt: new Date(now - 1000).toISOString() },
        { type: 'block', target: mutedHandle1, createdAt: new Date(now - 1000).toISOString() },
        { type: 'block', target: mutedHandle2, createdAt: new Date(now - 1000).toISOString() }
      ])

      await wait(8000)

      {
        const body = await server.blocklist.getStatus({
          accounts: [ mutedHandle1, mutedHandle2 ],
          hosts: [ mutedHost ]
        })

        expect(body.accounts[mutedHandle1].blockedByServer).to.be.true
        expect(body.accounts[mutedHandle1].blockedByServerSubscription).to.equal('Test subscription')
        expect(body.accounts[mutedHandle1].blockedByUser).to.be.false

        expect(body.accounts[mutedHandle2].blockedByServer).to.be.true
        expect(body.accounts[mutedHandle1].blockedByUser).to.be.false
        expect(body.accounts[mutedHandle2].blockedByServerSubscription).to.equal('Test subscription')

        expect(body.hosts[mutedHost].blockedByServer).to.be.true
        expect(body.hosts[mutedHost].blockedByUser).to.be.false
        expect(body.hosts[mutedHost].blockedByServerSubscription).to.equal('Test subscription')
      }

      mockServer.setActions([
        { type: 'block', target: mutedHandle1, createdAt: new Date(now - 1000).toISOString() },
        { type: 'unblock', target: mutedHandle1, createdAt: new Date(now + 2000).toISOString() }
      ])

      await wait(8000)

      {
        const body = await server.blocklist.getStatus({
          accounts: [ mutedHandle1 ]
        })

        expect(body.accounts[mutedHandle1].blockedByServer).to.be.false
        expect(body.accounts[mutedHandle1].blockedByServerSubscription).to.be.null
      }
    })

    it('Should only check new block status on next run', async function () {
      mockServer.setActions([
        { type: 'block', target: mutedHandle1, createdAt: new Date(new Date().getTime() - 100_000).toISOString() }
      ])

      await wait(8000)

      {
        const body = await server.blocklist.getStatus({
          accounts: [ mutedHandle1 ]
        })

        expect(body.accounts[mutedHandle1].blockedByServer).to.be.false
        expect(body.accounts[mutedHandle1].blockedByServerSubscription).to.be.null
      }
    })

    it('Should not remove manual blocks', async function () {
      await server.blocklist.addToServerBlocklist({ account: mutedHandle1 })

      mockServer.setActions([
        { type: 'block', target: mutedHandle1, createdAt: new Date(new Date().getTime() - 100_000).toISOString() },
        { type: 'unblock', target: mutedHandle1, createdAt: new Date(new Date().getTime() - 50_000).toISOString() }
      ])

      await wait(8000)

      {
        const body = await server.blocklist.getStatus({
          accounts: [ mutedHandle1, mutedHandle2 ]
        })

        expect(body.accounts[mutedHandle1].blockedByServer).to.be.true
        expect(body.accounts[mutedHandle1].blockedByServerSubscription).to.be.null
        expect(body.accounts[mutedHandle2].blockedByServer).to.be.true
        expect(body.accounts[mutedHandle2].blockedByServerSubscription).to.equal('Test subscription')
      }
    })

    it('Should list blocked accounts/servers', async function () {
      {
        const { total, data } = await server.blocklist.listServerServerBlocklist({ start: 0, count: 5 })

        expect(total).to.equal(1)
        expect(data[0].blockedServer.host).to.equal(mutedHost)
        expect(data[0].blocklistSubscription.name).to.equal('Test subscription')
        expect(data[0].blocklistSubscription.url).to.exist
      }

      {
        const { total, data } = await server.blocklist.listServerAccountBlocklist({ start: 0, count: 5, sort: 'createdAt' })

        expect(total).to.equal(2)
        expect(data[0].blockedAccount.name + '@' + data[0].blockedAccount.host).to.equal(mutedHandle2)
        expect(data[0].blocklistSubscription.name).to.equal('Test subscription')
        expect(data[0].blocklistSubscription.url).to.exist

        expect(data[1].blockedAccount.name + '@' + data[1].blockedAccount.host).to.equal(mutedHandle1)
        expect(data[1].blocklistSubscription).to.not.exist
      }

      {
        const { total, data } = await server.blocklist.listServerAccountBlocklist({
          start: 0,
          count: 5,
          subscriptionName: 'Test subscription'
        })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
        expect(data[0].blockedAccount.name + '@' + data[0].blockedAccount.host).to.equal(mutedHandle2)
      }

      {
        const { total, data } = await server.blocklist.listServerServerBlocklist({
          start: 0,
          count: 5,
          subscriptionName: 'Test subscription'
        })

        expect(total).to.equal(1)
        expect(data).to.have.lengthOf(1)
        expect(data[0].blockedServer.host).to.equal(mutedHost)
      }

      {
        const { total, data } = await server.blocklist.listServerAccountBlocklist({
          start: 0,
          count: 5,
          subscriptionName: 'unknown subscription name'
        })

        expect(total).to.equal(0)
        expect(data).to.have.lengthOf(0)
      }

      {
        const body = await server.blocklist.listServerBlocklistSubscriptions({ sort: 'name' })

        expect(body.total).to.equal(2)

        const testSubscription = body.data.find(s => s.name === 'Test subscription')
        expect(testSubscription).to.exist
        expect(testSubscription.mutedAccountsCount).to.equal(1)
        expect(testSubscription.mutedServersCount).to.equal(1)

        const anotherSubscription = body.data.find(s => s.name === 'another subscription list')
        expect(anotherSubscription).to.exist
        expect(anotherSubscription.mutedAccountsCount).to.equal(0)
        expect(anotherSubscription.mutedServersCount).to.equal(0)
      }
    })

    it('Should subscribe to another instance blocklist and synchronize', async function () {
      await server.config.updateExistingConfig({
        newConfig: {
          blocklist: {
            publicLog: {
              enabled: true
            }
          }
        }
      })

      await server2.blocklist.addServerBlocklistSubscription({ subscriptionUrl: `${server.url}/api/v1/server/blocklist/public-log` })
      await wait(8000)

      {
        const { data } = await server2.blocklist.listServerBlocklistSubscriptions({ search: 'public-log' })

        expect(data).to.have.lengthOf(1)
        expect(data[0].name).to.equal('PeerTube')
        expect(data[0].url).to.equal(`${server.url}/api/v1/server/blocklist/public-log`)
        expect(data[0].state.label).to.be.oneOf([ 'Synchronized', 'Processing' ])
      }

      {
        const body = await server2.blocklist.getStatus({
          accounts: [ mutedHandle1, mutedHandle2 ],
          hosts: [ mutedHost ]
        })

        expect(body.accounts[mutedHandle1].blockedByServer).to.be.true
        expect(body.accounts[mutedHandle1].blockedByServerSubscription).to.equal('PeerTube')

        expect(body.accounts[mutedHandle2].blockedByServer).to.be.false
        expect(body.accounts[mutedHandle2].blockedByServerSubscription).to.be.null

        expect(body.hosts[mutedHost].blockedByServer).to.be.false
        expect(body.hosts[mutedHost].blockedByServerSubscription).to.be.null
      }
    })

    it('Should delete a subscription', async function () {
      await server.blocklist.removeServerBlocklistSubscription({ id: subscriptionId })

      const body = await server.blocklist.getStatus({
        accounts: [ mutedHandle1, mutedHandle2 ]
      })

      expect(body.accounts[mutedHandle1].blockedByServer).to.be.true
      expect(body.accounts[mutedHandle1].blockedByServerSubscription).to.be.null
      expect(body.accounts[mutedHandle2].blockedByServer).to.be.false
      expect(body.accounts[mutedHandle2].blockedByServerSubscription).to.be.null
    })

    after(async function () {
      await cleanupTests([ server2 ])
    })
  })

  after(async function () {
    await cleanupTests([ server ])
    await mockServer.terminate()
  })
})
