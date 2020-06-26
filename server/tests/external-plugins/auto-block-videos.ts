/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import { Video, VideoBlacklist } from '@shared/models'
import {
  doubleFollow,
  getBlacklistedVideosList,
  getVideosList,
  installPlugin,
  MockBlocklist,
  removeVideoFromBlacklist,
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

async function check (server: ServerInfo, videoUUID: string, exists = true) {
  const res = await getVideosList(server.url)

  const video = res.body.data.find(v => v.uuid === videoUUID)

  if (exists) {
    expect(video).to.not.be.undefined
  } else {
    expect(video).to.be.undefined
  }
}

describe('Official plugin auto-block videos', function () {
  let servers: ServerInfo[]
  let blocklistServer: MockBlocklist
  let server1Videos: Video[] = []
  let server2Videos: Video[] = []

  before(async function () {
    this.timeout(60000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    for (const server of servers) {
      await installPlugin({
        url: server.url,
        accessToken: server.accessToken,
        npmName: 'peertube-plugin-auto-block-videos'
      })
    }

    blocklistServer = new MockBlocklist()
    await blocklistServer.initialize()

    await uploadVideoAndGetId({ server: servers[0], videoName: 'video server 1' })
    await uploadVideoAndGetId({ server: servers[1], videoName: 'video server 2' })
    await uploadVideoAndGetId({ server: servers[1], videoName: 'video 2 server 2' })
    await uploadVideoAndGetId({ server: servers[1], videoName: 'video 3 server 2' })

    {
      const res = await getVideosList(servers[0].url)
      server1Videos = res.body.data.map(v => Object.assign(v, { url: servers[0].url + '/videos/watch/' + v.uuid }))
    }

    {
      const res = await getVideosList(servers[1].url)
      server2Videos = res.body.data.map(v => Object.assign(v, { url: servers[1].url + '/videos/watch/' + v.uuid }))
    }

    await doubleFollow(servers[0], servers[1])
  })

  it('Should update plugin settings', async function () {
    await updatePluginSettings({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      npmName: 'peertube-plugin-auto-block-videos',
      settings: {
        'blocklist-urls': 'http://localhost:42100/blocklist',
        'check-seconds-interval': 1
      }
    })
  })

  it('Should auto block a video', async function () {
    this.timeout(10000)

    await check(servers[0], server2Videos[0].uuid, true)

    blocklistServer.replace({
      data: [
        {
          value: server2Videos[0].url
        }
      ]
    })

    await wait(2000)

    await check(servers[0], server2Videos[0].uuid, false)
  })

  it('Should have video in blacklists', async function () {
    const res = await getBlacklistedVideosList({ url: servers[0].url, token: servers[0].accessToken })

    const videoBlacklists = res.body.data as VideoBlacklist[]

    expect(videoBlacklists).to.have.lengthOf(1)
    expect(videoBlacklists[0].reason).to.contains('Automatically blocked from auto block plugin')
    expect(videoBlacklists[0].video.name).to.equal(server2Videos[0].name)
  })

  it('Should not block a local video', async function () {
    this.timeout(10000)

    await check(servers[0], server1Videos[0].uuid, true)

    blocklistServer.replace({
      data: [
        {
          value: server1Videos[0].url
        }
      ]
    })

    await wait(2000)

    await check(servers[0], server1Videos[0].uuid, true)
  })

  it('Should remove a video block', async function () {
    this.timeout(10000)

    await check(servers[0], server2Videos[0].uuid, false)

    blocklistServer.replace({
      data: [
        {
          value: server2Videos[0].url,
          action: 'remove'
        }
      ]
    })

    await wait(2000)

    await check(servers[0], server2Videos[0].uuid, true)
  })

  it('Should auto block a video, manually unblock it and do not reblock it automatically', async function () {
    this.timeout(20000)

    const video = server2Videos[1]

    await check(servers[0], video.uuid, true)

    blocklistServer.replace({
      data: [
        {
          value: video.url,
          updatedAt: new Date().toISOString()
        }
      ]
    })

    await wait(2000)

    await check(servers[0], video.uuid, false)

    await removeVideoFromBlacklist(servers[0].url, servers[0].accessToken, video.uuid)

    await check(servers[0], video.uuid, true)

    killallServers([ servers[0] ])
    await reRunServer(servers[0])
    await wait(2000)

    await check(servers[0], video.uuid, true)
  })

  after(async function () {
    await blocklistServer.terminate()

    await cleanupTests(servers)
  })
})
