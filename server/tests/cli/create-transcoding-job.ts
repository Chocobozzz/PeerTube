/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import { VideoDetails } from '../../../shared/models/videos'
const expect = chai.expect

import {
  execCLI,
  flushTests,
  getEnvCli,
  getVideosList,
  killallServers,
  parseTorrentVideo,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  wait,
  getVideo, flushAndRunMultipleServers, doubleFollow
} from '../utils'

describe('Test create transcoding jobs', function () {
  let servers: ServerInfo[] = []
  let video2UUID: string

  before(async function () {
    this.timeout(60000)

    await flushTests()

    // Run server 2 to have transcoding enabled
    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    // Upload two videos for our needs
    await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video1' })
    const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video2' })
    video2UUID = res.body.video.uuid

    await wait(3000)
  })

  it('Should have two video files on each server', async function () {
    this.timeout(30000)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      const videos = res.body.data
      expect(videos).to.have.lengthOf(2)

      for (const video of videos) {
        const res2 = await getVideo(server.url, video.uuid)
        const videoDetail: VideoDetails = res2.body
        expect(videoDetail.files).to.have.lengthOf(1)
      }
    }
  })

  it('Should run a transcoding job on video 2', async function () {
    this.timeout(60000)

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-transcoding-job -- -v ${video2UUID}`)

    await wait(40000)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      const videos = res.body.data
      expect(videos).to.have.lengthOf(2)

      let infoHashes: { [ id: number ]: string }

      for (const video of videos) {
        const res2 = await getVideo(server.url, video.uuid)
        const videoDetail: VideoDetails = res2.body

        if (video.uuid === video2UUID) {
          expect(videoDetail.files).to.have.lengthOf(4)

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
        }
      }
    }
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
