/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'

describe('Test videos files', function () {
  let servers: PeerTubeServer[]

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(150_000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscoding(true, true)
  })

  describe('When deleting all files', function () {
    let validId1: string
    let validId2: string

    before(async function () {
      this.timeout(360_000)

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

    it('Should delete web video files', async function () {
      this.timeout(30_000)

      await servers[0].videos.removeAllWebVideoFiles({ videoId: validId1 })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: validId1 })

        expect(video.files).to.have.lengthOf(0)
        expect(video.streamingPlaylists).to.have.lengthOf(1)
      }
    })

    it('Should delete HLS files', async function () {
      this.timeout(30_000)

      await servers[0].videos.removeHLSPlaylist({ videoId: validId2 })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: validId2 })

        expect(video.files).to.have.length.above(0)
        expect(video.streamingPlaylists).to.have.lengthOf(0)
      }
    })
  })

  describe('When deleting a specific file', function () {
    let webVideoId: string
    let hlsId: string

    before(async function () {
      this.timeout(120_000)

      {
        const { uuid } = await servers[0].videos.quickUpload({ name: 'web-video' })
        webVideoId = uuid
      }

      {
        const { uuid } = await servers[0].videos.quickUpload({ name: 'hls' })
        hlsId = uuid
      }

      await waitJobs(servers)
    })

    it('Shoulde delete a web video file', async function () {
      this.timeout(30_000)

      const video = await servers[0].videos.get({ id: webVideoId })
      const files = video.files

      await servers[0].videos.removeWebVideoFile({ videoId: webVideoId, fileId: files[0].id })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: webVideoId })

        expect(video.files).to.have.lengthOf(files.length - 1)
        expect(video.files.find(f => f.id === files[0].id)).to.not.exist
      }
    })

    it('Should delete all web video files', async function () {
      this.timeout(30_000)

      const video = await servers[0].videos.get({ id: webVideoId })
      const files = video.files

      for (const file of files) {
        await servers[0].videos.removeWebVideoFile({ videoId: webVideoId, fileId: file.id })
      }

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: webVideoId })

        expect(video.files).to.have.lengthOf(0)
      }
    })

    it('Should delete a hls file', async function () {
      this.timeout(30_000)

      const video = await servers[0].videos.get({ id: hlsId })
      const files = video.streamingPlaylists[0].files
      const toDelete = files[0]

      await servers[0].videos.removeHLSFile({ videoId: hlsId, fileId: toDelete.id })

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: hlsId })

        expect(video.streamingPlaylists[0].files).to.have.lengthOf(files.length - 1)
        expect(video.streamingPlaylists[0].files.find(f => f.id === toDelete.id)).to.not.exist

        const { text } = await makeRawRequest({ url: video.streamingPlaylists[0].playlistUrl, expectedStatus: HttpStatusCode.OK_200 })

        expect(text.includes(`-${toDelete.resolution.id}.m3u8`)).to.be.false
        expect(text.includes(`-${video.streamingPlaylists[0].files[0].resolution.id}.m3u8`)).to.be.true
      }
    })

    it('Should delete all hls files', async function () {
      this.timeout(30_000)

      const video = await servers[0].videos.get({ id: hlsId })
      const files = video.streamingPlaylists[0].files

      for (const file of files) {
        await servers[0].videos.removeHLSFile({ videoId: hlsId, fileId: file.id })
      }

      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: hlsId })

        expect(video.streamingPlaylists).to.have.lengthOf(0)
      }
    })

    it('Should not delete last file of a video', async function () {
      this.timeout(60_000)

      const webVideoOnly = await servers[0].videos.get({ id: hlsId })
      const hlsOnly = await servers[0].videos.get({ id: webVideoId })

      for (let i = 0; i < 4; i++) {
        await servers[0].videos.removeWebVideoFile({ videoId: webVideoOnly.id, fileId: webVideoOnly.files[i].id })
        await servers[0].videos.removeHLSFile({ videoId: hlsOnly.id, fileId: hlsOnly.streamingPlaylists[0].files[i].id })
      }

      const expectedStatus = HttpStatusCode.BAD_REQUEST_400
      await servers[0].videos.removeWebVideoFile({ videoId: webVideoOnly.id, fileId: webVideoOnly.files[4].id, expectedStatus })
      await servers[0].videos.removeHLSFile({ videoId: hlsOnly.id, fileId: hlsOnly.streamingPlaylists[0].files[4].id, expectedStatus })
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
