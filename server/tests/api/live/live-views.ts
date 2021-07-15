/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { VideoPrivacy } from '@shared/models'
import {
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  wait,
  waitJobs,
  waitUntilLivePublishedOnAllServers
} from '../../../../shared/extra-utils'

const expect = chai.expect

describe('Test live', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await servers[0].configCommand.updateCustomSubConfig({
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

  describe('Live views', function () {
    let liveVideoId: string
    let command: FfmpegCommand

    async function countViews (expected: number) {
      for (const server of servers) {
        const video = await server.videosCommand.get({ id: liveVideoId })
        expect(video.views).to.equal(expected)
      }
    }

    before(async function () {
      this.timeout(30000)

      const liveAttributes = {
        name: 'live video',
        channelId: servers[0].videoChannel.id,
        privacy: VideoPrivacy.PUBLIC
      }

      const live = await servers[0].liveCommand.create({ fields: liveAttributes })
      liveVideoId = live.uuid

      command = await servers[0].liveCommand.sendRTMPStreamInVideo({ videoId: liveVideoId })
      await waitUntilLivePublishedOnAllServers(servers, liveVideoId)
      await waitJobs(servers)
    })

    it('Should display no views for a live', async function () {
      await countViews(0)
    })

    it('Should view a live twice and display 1 view', async function () {
      this.timeout(30000)

      await servers[0].videosCommand.view({ id: liveVideoId })
      await servers[0].videosCommand.view({ id: liveVideoId })

      await wait(7000)

      await waitJobs(servers)

      await countViews(1)
    })

    it('Should wait and display 0 views', async function () {
      this.timeout(30000)

      await wait(12000)
      await waitJobs(servers)

      await countViews(0)
    })

    it('Should view a live on a remote and on local and display 2 views', async function () {
      this.timeout(30000)

      await servers[0].videosCommand.view({ id: liveVideoId })
      await servers[1].videosCommand.view({ id: liveVideoId })
      await servers[1].videosCommand.view({ id: liveVideoId })

      await wait(7000)
      await waitJobs(servers)

      await countViews(2)
    })

    after(async function () {
      await stopFfmpeg(command)
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
