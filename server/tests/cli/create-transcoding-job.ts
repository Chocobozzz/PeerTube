/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  doubleFollow,
  flushAndRunMultipleServers,
  ServerInfo,
  setAccessTokensToServers,
  waitJobs
} from '../../../shared/extra-utils'

const expect = chai.expect

describe('Test create transcoding jobs', function () {
  let servers: ServerInfo[] = []
  const videosUUID: string[] = []

  const config = {
    transcoding: {
      enabled: false,
      resolutions: {
        '240p': true,
        '360p': true,
        '480p': true,
        '720p': true,
        '1080p': true,
        '1440p': true,
        '2160p': true
      },
      hls: {
        enabled: false
      }
    }
  }

  before(async function () {
    this.timeout(60000)

    // Run server 2 to have transcoding enabled
    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await servers[0].config.updateCustomSubConfig({ newConfig: config })

    await doubleFollow(servers[0], servers[1])

    for (let i = 1; i <= 5; i++) {
      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video' + i } })
      videosUUID.push(uuid)
    }

    await waitJobs(servers)
  })

  it('Should have two video files on each server', async function () {
    this.timeout(30000)

    for (const server of servers) {
      const { data } = await server.videos.list()
      expect(data).to.have.lengthOf(videosUUID.length)

      for (const video of data) {
        const videoDetail = await server.videos.get({ id: video.uuid })
        expect(videoDetail.files).to.have.lengthOf(1)
        expect(videoDetail.streamingPlaylists).to.have.lengthOf(0)
      }
    }
  })

  it('Should run a transcoding job on video 2', async function () {
    this.timeout(60000)

    await servers[0].cli.execWithEnv(`npm run create-transcoding-job -- -v ${videosUUID[1]}`)
    await waitJobs(servers)

    for (const server of servers) {
      const { data } = await server.videos.list()

      let infoHashes: { [id: number]: string }

      for (const video of data) {
        const videoDetail = await server.videos.get({ id: video.uuid })

        if (video.uuid === videosUUID[1]) {
          expect(videoDetail.files).to.have.lengthOf(4)
          expect(videoDetail.streamingPlaylists).to.have.lengthOf(0)

          if (!infoHashes) {
            infoHashes = {}

            for (const file of videoDetail.files) {
              infoHashes[file.resolution.id.toString()] = file.magnetUri
            }
          } else {
            for (const resolution of Object.keys(infoHashes)) {
              const file = videoDetail.files.find(f => f.resolution.id.toString() === resolution)
              expect(file.magnetUri).to.equal(infoHashes[resolution])
            }
          }
        } else {
          expect(videoDetail.files).to.have.lengthOf(1)
          expect(videoDetail.streamingPlaylists).to.have.lengthOf(0)
        }
      }
    }
  })

  it('Should run a transcoding job on video 1 with resolution', async function () {
    this.timeout(60000)

    await servers[0].cli.execWithEnv(`npm run create-transcoding-job -- -v ${videosUUID[0]} -r 480`)

    await waitJobs(servers)

    for (const server of servers) {
      const { data } = await server.videos.list()
      expect(data).to.have.lengthOf(videosUUID.length)

      const videoDetails = await server.videos.get({ id: videosUUID[0] })

      expect(videoDetails.files).to.have.lengthOf(2)
      expect(videoDetails.files[0].resolution.id).to.equal(720)
      expect(videoDetails.files[1].resolution.id).to.equal(480)

      expect(videoDetails.streamingPlaylists).to.have.lengthOf(0)
    }
  })

  it('Should generate an HLS resolution', async function () {
    this.timeout(120000)

    await servers[0].cli.execWithEnv(`npm run create-transcoding-job -- -v ${videosUUID[2]} --generate-hls -r 480`)

    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videosUUID[2] })

      expect(videoDetails.files).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)

      const files = videoDetails.streamingPlaylists[0].files
      expect(files).to.have.lengthOf(1)
      expect(files[0].resolution.id).to.equal(480)
    }
  })

  it('Should not duplicate an HLS resolution', async function () {
    this.timeout(120000)

    await servers[0].cli.execWithEnv(`npm run create-transcoding-job -- -v ${videosUUID[2]} --generate-hls -r 480`)

    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videosUUID[2] })

      const files = videoDetails.streamingPlaylists[0].files
      expect(files).to.have.lengthOf(1)
      expect(files[0].resolution.id).to.equal(480)
    }
  })

  it('Should generate all HLS resolutions', async function () {
    this.timeout(120000)

    await servers[0].cli.execWithEnv(`npm run create-transcoding-job -- -v ${videosUUID[3]} --generate-hls`)

    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videosUUID[3] })

      expect(videoDetails.files).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)

      const files = videoDetails.streamingPlaylists[0].files
      expect(files).to.have.lengthOf(4)
    }
  })

  it('Should optimize the video file and generate HLS videos if enabled in config', async function () {
    this.timeout(120000)

    config.transcoding.hls.enabled = true
    await servers[0].config.updateCustomSubConfig({ newConfig: config })

    await servers[0].cli.execWithEnv(`npm run create-transcoding-job -- -v ${videosUUID[4]}`)

    await waitJobs(servers)

    for (const server of servers) {
      const videoDetails = await server.videos.get({ id: videosUUID[4] })

      expect(videoDetails.files).to.have.lengthOf(4)
      expect(videoDetails.streamingPlaylists).to.have.lengthOf(1)
      expect(videoDetails.streamingPlaylists[0].files).to.have.lengthOf(4)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
