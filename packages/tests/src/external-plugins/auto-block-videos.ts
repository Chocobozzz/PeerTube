/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { Video } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { MockBlocklist } from '../shared/mock-servers/index.js'

async function check (server: PeerTubeServer, videoUUID: string, exists = true) {
  const { data } = await server.videos.list()

  const video = data.find(v => v.uuid === videoUUID)

  if (exists) expect(video).to.not.be.undefined
  else expect(video).to.be.undefined
}

describe('Official plugin auto-block videos', function () {
  let servers: PeerTubeServer[]
  let blocklistServer: MockBlocklist
  let server1Videos: Video[] = []
  let server2Videos: Video[] = []
  let port: number

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    for (const server of servers) {
      await server.plugins.install({ npmName: 'peertube-plugin-auto-block-videos' })
    }

    blocklistServer = new MockBlocklist()
    port = await blocklistServer.initialize()

    await servers[0].videos.quickUpload({ name: 'video server 1' })
    await servers[1].videos.quickUpload({ name: 'video server 2' })
    await servers[1].videos.quickUpload({ name: 'video 2 server 2' })
    await servers[1].videos.quickUpload({ name: 'video 3 server 2' })

    {
      const { data } = await servers[0].videos.list()
      server1Videos = data.map(v => Object.assign(v, { url: servers[0].url + '/videos/watch/' + v.uuid }))
    }

    {
      const { data } = await servers[1].videos.list()
      server2Videos = data.map(v => Object.assign(v, { url: servers[1].url + '/videos/watch/' + v.uuid }))
    }

    await doubleFollow(servers[0], servers[1])
  })

  it('Should update plugin settings', async function () {
    await servers[0].plugins.updateSettings({
      npmName: 'peertube-plugin-auto-block-videos',
      settings: {
        'blocklist-urls': `http://127.0.0.1:${port}/blocklist`,
        'check-seconds-interval': 1
      }
    })
  })

  it('Should auto block a video', async function () {
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
    const body = await servers[0].blacklist.list()

    const videoBlacklists = body.data
    expect(videoBlacklists).to.have.lengthOf(1)
    expect(videoBlacklists[0].reason).to.contains('Automatically blocked from auto block plugin')
    expect(videoBlacklists[0].video.name).to.equal(server2Videos[0].name)
  })

  it('Should not block a local video', async function () {
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

    await servers[0].blacklist.remove({ videoId: video.uuid })

    await check(servers[0], video.uuid, true)

    await killallServers([ servers[0] ])
    await servers[0].run()
    await wait(2000)

    await check(servers[0], video.uuid, true)
  })

  after(async function () {
    await blocklistServer.terminate()

    await cleanupTests(servers)
  })
})
