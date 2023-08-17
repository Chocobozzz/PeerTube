/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  killallServers,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { MockBlocklist } from '../shared/mock-servers/index.js'

describe('Official plugin auto-mute', function () {
  const autoMuteListPath = '/plugins/auto-mute/router/api/v1/mute-list'
  let servers: PeerTubeServer[]
  let blocklistServer: MockBlocklist
  let port: number

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    for (const server of servers) {
      await server.plugins.install({ npmName: 'peertube-plugin-auto-mute' })
    }

    blocklistServer = new MockBlocklist()
    port = await blocklistServer.initialize()

    await servers[0].videos.quickUpload({ name: 'video server 1' })
    await servers[1].videos.quickUpload({ name: 'video server 2' })

    await doubleFollow(servers[0], servers[1])
  })

  it('Should update plugin settings', async function () {
    await servers[0].plugins.updateSettings({
      npmName: 'peertube-plugin-auto-mute',
      settings: {
        'blocklist-urls': `http://127.0.0.1:${port}/blocklist`,
        'check-seconds-interval': 1
      }
    })
  })

  it('Should add a server blocklist', async function () {
    blocklistServer.replace({
      data: [
        {
          value: servers[1].host
        }
      ]
    })

    await wait(2000)

    const { total } = await servers[0].videos.list()
    expect(total).to.equal(1)
  })

  it('Should remove a server blocklist', async function () {
    blocklistServer.replace({
      data: [
        {
          value: servers[1].host,
          action: 'remove'
        }
      ]
    })

    await wait(2000)

    const { total } = await servers[0].videos.list()
    expect(total).to.equal(2)
  })

  it('Should add an account blocklist', async function () {
    blocklistServer.replace({
      data: [
        {
          value: 'root@' + servers[1].host
        }
      ]
    })

    await wait(2000)

    const { total } = await servers[0].videos.list()
    expect(total).to.equal(1)
  })

  it('Should remove an account blocklist', async function () {
    blocklistServer.replace({
      data: [
        {
          value: 'root@' + servers[1].host,
          action: 'remove'
        }
      ]
    })

    await wait(2000)

    const { total } = await servers[0].videos.list()
    expect(total).to.equal(2)
  })

  it('Should auto mute an account, manually unmute it and do not remute it automatically', async function () {
    this.timeout(20000)

    const account = 'root@' + servers[1].host

    blocklistServer.replace({
      data: [
        {
          value: account,
          updatedAt: new Date().toISOString()
        }
      ]
    })

    await wait(2000)

    {
      const { total } = await servers[0].videos.list()
      expect(total).to.equal(1)
    }

    await servers[0].blocklist.removeFromServerBlocklist({ account })

    {
      const { total } = await servers[0].videos.list()
      expect(total).to.equal(2)
    }

    await killallServers([ servers[0] ])
    await servers[0].run()
    await wait(2000)

    {
      const { total } = await servers[0].videos.list()
      expect(total).to.equal(2)
    }
  })

  it('Should not expose the auto mute list', async function () {
    await makeGetRequest({
      url: servers[0].url,
      path: '/plugins/auto-mute/router/api/v1/mute-list',
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should enable auto mute list', async function () {
    await servers[0].plugins.updateSettings({
      npmName: 'peertube-plugin-auto-mute',
      settings: {
        'blocklist-urls': '',
        'check-seconds-interval': 1,
        'expose-mute-list': true
      }
    })

    await makeGetRequest({
      url: servers[0].url,
      path: '/plugins/auto-mute/router/api/v1/mute-list',
      expectedStatus: HttpStatusCode.OK_200
    })
  })

  it('Should mute an account on server 1, and server 2 auto mutes it', async function () {
    this.timeout(20000)

    await servers[1].plugins.updateSettings({
      npmName: 'peertube-plugin-auto-mute',
      settings: {
        'blocklist-urls': 'http://' + servers[0].host + autoMuteListPath,
        'check-seconds-interval': 1,
        'expose-mute-list': false
      }
    })

    await servers[0].blocklist.addToServerBlocklist({ account: 'root@' + servers[1].host })
    await servers[0].blocklist.addToMyBlocklist({ server: servers[1].host })

    const res = await makeGetRequest({
      url: servers[0].url,
      path: '/plugins/auto-mute/router/api/v1/mute-list',
      expectedStatus: HttpStatusCode.OK_200
    })

    const data = res.body.data
    expect(data).to.have.lengthOf(1)
    expect(data[0].updatedAt).to.exist
    expect(data[0].value).to.equal('root@' + servers[1].host)

    await wait(2000)

    for (const server of servers) {
      const { total } = await server.videos.list()
      expect(total).to.equal(1)
    }
  })

  after(async function () {
    await blocklistServer.terminate()

    await cleanupTests(servers)
  })
})
