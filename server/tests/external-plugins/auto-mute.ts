/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'


import { installPlugin, MockBlocklist, setAccessTokensToServers, uploadVideoAndGetId, updatePluginSettings, doubleFollow, getVideosList, wait } from '../../../shared/extra-utils'
import { cleanupTests, flushAndRunMultipleServers, ServerInfo } from '../../../shared/extra-utils/server/servers'
import { expect } from 'chai'

describe('Official plugin auto-mute', function () {
  let servers: ServerInfo[]
  let blocklistServer: MockBlocklist

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await installPlugin({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      npmName: 'peertube-plugin-auto-mute'
    })

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

  after(async function () {
    await cleanupTests(servers)
  })
})
