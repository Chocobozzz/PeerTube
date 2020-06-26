/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import {
  addAccountToServerBlocklist,
  addServerToAccountBlocklist,
  removeAccountFromServerBlocklist
} from '@shared/extra-utils/users/blocklist'
import {
  doubleFollow,
  getVideosList,
  installPlugin,
  makeGetRequest,
  MockBlocklist,
  setAccessTokensToServers,
  updatePluginSettings,
  uploadVideoAndGetId,
  wait
} from '../../../shared/extra-utils'
import {
  cleanupTests,
  flushAndRunMultipleServers,
  killallServers,
  reRunServer,
  ServerInfo
} from '../../../shared/extra-utils/server/servers'

describe('Official plugin auto-mute', function () {
  const autoMuteListPath = '/plugins/auto-mute/router/api/v1/mute-list'
  let servers: ServerInfo[]
  let blocklistServer: MockBlocklist

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    for (const server of servers) {
      await installPlugin({
        url: server.url,
        accessToken: server.accessToken,
        npmName: 'peertube-plugin-auto-mute'
      })
    }

    blocklistServer = new MockBlocklist()
    await blocklistServer.initialize()

    await uploadVideoAndGetId({ server: servers[0], videoName: 'video server 1' })
    await uploadVideoAndGetId({ server: servers[1], videoName: 'video server 2' })

    await doubleFollow(servers[0], servers[1])
  })

  it('Should update plugin settings', async function () {
    await updatePluginSettings({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      npmName: 'peertube-plugin-auto-mute',
      settings: {
        'blocklist-urls': 'http://localhost:42100/blocklist',
        'check-seconds-interval': 1
      }
    })
  })

  it('Should add a server blocklist', async function () {
    this.timeout(10000)

    blocklistServer.replace({
      data: [
        {
          value: 'localhost:' + servers[1].port
        }
      ]
    })

    await wait(2000)

    const res = await getVideosList(servers[0].url)
    expect(res.body.total).to.equal(1)
  })

  it('Should remove a server blocklist', async function () {
    this.timeout(10000)

    blocklistServer.replace({
      data: [
        {
          value: 'localhost:' + servers[1].port,
          action: 'remove'
        }
      ]
    })

    await wait(2000)

    const res = await getVideosList(servers[0].url)
    expect(res.body.total).to.equal(2)
  })

  it('Should add an account blocklist', async function () {
    this.timeout(10000)

    blocklistServer.replace({
      data: [
        {
          value: 'root@localhost:' + servers[1].port
        }
      ]
    })

    await wait(2000)

    const res = await getVideosList(servers[0].url)
    expect(res.body.total).to.equal(1)
  })

  it('Should remove an account blocklist', async function () {
    this.timeout(10000)

    blocklistServer.replace({
      data: [
        {
          value: 'root@localhost:' + servers[1].port,
          action: 'remove'
        }
      ]
    })

    await wait(2000)

    const res = await getVideosList(servers[0].url)
    expect(res.body.total).to.equal(2)
  })

  it('Should auto mute an account, manually unmute it and do not remute it automatically', async function () {
    this.timeout(20000)

    const account = 'root@localhost:' + servers[1].port

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
      const res = await getVideosList(servers[0].url)
      expect(res.body.total).to.equal(1)
    }

    await removeAccountFromServerBlocklist(servers[0].url, servers[0].accessToken, account)

    {
      const res = await getVideosList(servers[0].url)
      expect(res.body.total).to.equal(2)
    }

    killallServers([ servers[0] ])
    await reRunServer(servers[0])
    await wait(2000)

    {
      const res = await getVideosList(servers[0].url)
      expect(res.body.total).to.equal(2)
    }
  })

  it('Should not expose the auto mute list', async function () {
    await makeGetRequest({
      url: servers[0].url,
      path: '/plugins/auto-mute/router/api/v1/mute-list',
      statusCodeExpected: 403
    })
  })

  it('Should enable auto mute list', async function () {
    await updatePluginSettings({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
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
      statusCodeExpected: 200
    })
  })

  it('Should mute an account on server 1, and server 2 auto mutes it', async function () {
    this.timeout(20000)

    await updatePluginSettings({
      url: servers[1].url,
      accessToken: servers[1].accessToken,
      npmName: 'peertube-plugin-auto-mute',
      settings: {
        'blocklist-urls': 'http://localhost:' + servers[0].port + autoMuteListPath,
        'check-seconds-interval': 1,
        'expose-mute-list': false
      }
    })

    await addAccountToServerBlocklist(servers[0].url, servers[0].accessToken, 'root@localhost:' + servers[1].port)
    await addServerToAccountBlocklist(servers[0].url, servers[0].accessToken, 'localhost:' + servers[1].port)

    const res = await makeGetRequest({
      url: servers[0].url,
      path: '/plugins/auto-mute/router/api/v1/mute-list',
      statusCodeExpected: 200
    })

    const data = res.body.data
    expect(data).to.have.lengthOf(1)
    expect(data[0].updatedAt).to.exist
    expect(data[0].value).to.equal('root@localhost:' + servers[1].port)

    await wait(2000)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      expect(res.body.total).to.equal(1)
    }
  })

  after(async function () {
    await blocklistServer.terminate()

    await cleanupTests(servers)
  })
})
