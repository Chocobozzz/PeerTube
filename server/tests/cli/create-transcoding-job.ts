/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { VideoDetails } from '../../../shared/models/videos'
import {
  cleanupTests,
  doubleFollow,
  execCLI,
  flushAndRunMultipleServers,
  getEnvCli,
  getVideo,
  getVideosList,
  ServerInfo,
  setAccessTokensToServers,
  updateCustomSubConfig,
  uploadVideo
} from '../../../shared/extra-utils'
import { waitJobs } from '../../../shared/extra-utils/server/jobs'

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

    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, config)

    await doubleFollow(servers[0], servers[1])

    for (let i = 1; i <= 5; i++) {
      const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video' + i })
      videosUUID.push(res.body.video.uuid)
    }

    await waitJobs(servers)
  })

  it('Should have two video files on each server', async function () {
    this.timeout(30000)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      const videos = res.body.data
      expect(videos).to.have.lengthOf(videosUUID.length)

      for (const video of videos) {
        const res2 = await getVideo(server.url, video.uuid)
        const videoDetail: VideoDetails = res2.body
        expect(videoDetail.files).to.have.lengthOf(1)
        expect(videoDetail.streamingPlaylists).to.have.lengthOf(0)
      }
    }
  })

  it('Should run a transcoding job on video 2', async function () {
    this.timeout(60000)

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-transcoding-job -- -v ${videosUUID[1]}`)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      const videos = res.body.data

      let infoHashes: { [id: number]: string }

      for (const video of videos) {
        const res2 = await getVideo(server.url, video.uuid)
        const videoDetail: VideoDetails = res2.body

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

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-transcoding-job -- -v ${videosUUID[0]} -r 480`)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      const videos = res.body.data
      expect(videos).to.have.lengthOf(videosUUID.length)

      const res2 = await getVideo(server.url, videosUUID[0])
      const videoDetail: VideoDetails = res2.body

      expect(videoDetail.files).to.have.lengthOf(2)
      expect(videoDetail.files[0].resolution.id).to.equal(720)
      expect(videoDetail.files[1].resolution.id).to.equal(480)

      expect(videoDetail.streamingPlaylists).to.have.lengthOf(0)
    }
  })

  it('Should generate an HLS resolution', async function () {
    this.timeout(120000)

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-transcoding-job -- -v ${videosUUID[2]} --generate-hls -r 480`)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideo(server.url, videosUUID[2])
      const videoDetail: VideoDetails = res.body

      expect(videoDetail.files).to.have.lengthOf(1)
      expect(videoDetail.streamingPlaylists).to.have.lengthOf(1)

      const files = videoDetail.streamingPlaylists[0].files
      expect(files).to.have.lengthOf(1)
      expect(files[0].resolution.id).to.equal(480)
    }
  })

  it('Should not duplicate an HLS resolution', async function () {
    this.timeout(120000)

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-transcoding-job -- -v ${videosUUID[2]} --generate-hls -r 480`)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideo(server.url, videosUUID[2])
      const videoDetail: VideoDetails = res.body

      const files = videoDetail.streamingPlaylists[0].files
      expect(files).to.have.lengthOf(1)
      expect(files[0].resolution.id).to.equal(480)
    }
  })

  it('Should generate all HLS resolutions', async function () {
    this.timeout(120000)

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-transcoding-job -- -v ${videosUUID[3]} --generate-hls`)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideo(server.url, videosUUID[3])
      const videoDetail: VideoDetails = res.body

      expect(videoDetail.files).to.have.lengthOf(1)
      expect(videoDetail.streamingPlaylists).to.have.lengthOf(1)

      const files = videoDetail.streamingPlaylists[0].files
      expect(files).to.have.lengthOf(4)
    }
  })

  it('Should optimize the video file and generate HLS videos if enabled in config', async function () {
    this.timeout(120000)

    config.transcoding.hls.enabled = true
    await updateCustomSubConfig(servers[0].url, servers[0].accessToken, config)

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-transcoding-job -- -v ${videosUUID[4]}`)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideo(server.url, videosUUID[4])
      const videoDetail: VideoDetails = res.body

      expect(videoDetail.files).to.have.lengthOf(4)
      expect(videoDetail.streamingPlaylists).to.have.lengthOf(1)
      expect(videoDetail.streamingPlaylists[0].files).to.have.lengthOf(4)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
