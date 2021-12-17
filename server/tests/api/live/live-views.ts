/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { wait } from '@shared/core-utils'
import { VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs,
  waitUntilLivePublishedOnAllServers
} from '@shared/server-commands'

const expect = chai.expect

describe('Live views', function () {
  let servers: PeerTubeServer[] = []

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await servers[0].config.updateCustomSubConfig({
      newConfig: {
        live: {
          enabled: true,
          allowReplay: true,
          transcoding: {
            enabled: false
          }
        }
      }
    })

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
  })

  let liveVideoId: string
  let command: FfmpegCommand

  async function countViewers (expectedViewers: number) {
    for (const server of servers) {
      const video = await server.videos.get({ id: liveVideoId })
      expect(video.viewers).to.equal(expectedViewers)
    }
  }

  async function countViews (expectedViews: number) {
    for (const server of servers) {
      const video = await server.videos.get({ id: liveVideoId })
      expect(video.views).to.equal(expectedViews)
    }
  }

  before(async function () {
    this.timeout(30000)

    const liveAttributes = {
      name: 'live video',
      channelId: servers[0].store.channel.id,
      privacy: VideoPrivacy.PUBLIC
    }

    const live = await servers[0].live.create({ fields: liveAttributes })
    liveVideoId = live.uuid

    command = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideoId })
    await waitUntilLivePublishedOnAllServers(servers, liveVideoId)
    await waitJobs(servers)
  })

  it('Should display no views and viewers for a live', async function () {
    await countViews(0)
    await countViewers(0)
  })

  it('Should view a live twice and display 1 view/viewer', async function () {
    this.timeout(30000)

    await servers[0].videos.view({ id: liveVideoId })
    await servers[0].videos.view({ id: liveVideoId })

    await waitJobs(servers)
    await countViewers(1)

    await wait(7000)
    await countViews(1)
  })

  it('Should wait and display 0 viewers while still have 1 view', async function () {
    this.timeout(30000)

    await wait(12000)
    await waitJobs(servers)

    await countViews(1)
    await countViewers(0)
  })

  it('Should view a live on a remote and on local and display 2 viewers and 3 views', async function () {
    this.timeout(30000)

    await servers[0].videos.view({ id: liveVideoId })
    await servers[1].videos.view({ id: liveVideoId })
    await servers[1].videos.view({ id: liveVideoId })
    await waitJobs(servers)

    await countViewers(2)

    await wait(7000)
    await waitJobs(servers)

    await countViews(3)
  })

  after(async function () {
    await stopFfmpeg(command)
    await cleanupTests(servers)
  })
})
