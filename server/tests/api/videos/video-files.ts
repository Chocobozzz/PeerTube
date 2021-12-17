/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

describe('Test videos files', function () {
  let servers: PeerTubeServer[]
  let validId1: string
  let validId2: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(150_000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscoding(true, true)

    {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video 1' })
      validId1 = uuid
    }

    {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video 2' })
      validId2 = uuid
    }

    await waitJobs(servers)
  })

  it('Should delete webtorrent files', async function () {
    this.timeout(30_000)

    await servers[0].videos.removeWebTorrentFiles({ videoId: validId1 })

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: validId1 })

      expect(video.files).to.have.lengthOf(0)
      expect(video.streamingPlaylists).to.have.lengthOf(1)
    }
  })

  it('Should delete HLS files', async function () {
    this.timeout(30_000)

    await servers[0].videos.removeHLSFiles({ videoId: validId2 })

    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: validId2 })

      expect(video.files).to.have.length.above(0)
      expect(video.streamingPlaylists).to.have.lengthOf(0)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
