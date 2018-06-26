/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import { VideoDetails } from '../../../shared/models/videos'
import {
  doubleFollow,
  execCLI,
  flushAndRunMultipleServers,
  flushTests,
  getEnvCli,
  getVideo,
  getVideosList,
  killallServers,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo, wait
} from '../utils'
import { waitJobs } from '../utils/server/jobs'

const expect = chai.expect

describe('Test create transcoding jobs', function () {
  let servers: ServerInfo[] = []
  let video1UUID: string
  let video2UUID: string

  before(async function () {
    this.timeout(60000)

    await flushTests()

    // Run server 2 to have transcoding enabled
    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    // Upload two videos for our needs
    const res1 = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video1' })
    video1UUID = res1.body.video.uuid
    const res2 = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video2' })
    video2UUID = res2.body.video.uuid

    await waitJobs(servers)
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

    await waitJobs(servers)

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

  it('Should run a transcoding job on video 1 with resolution', async function () {
    this.timeout(60000)

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-transcoding-job -- -v ${video1UUID} -r 480`)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      const videos = res.body.data
      expect(videos).to.have.lengthOf(2)

      const res2 = await getVideo(server.url, video1UUID)
      const videoDetail: VideoDetails = res2.body

      expect(videoDetail.files).to.have.lengthOf(2)

      expect(videoDetail.files[0].resolution.id).to.equal(720)

      expect(videoDetail.files[1].resolution.id).to.equal(480)
    }
  })

  after(async function () {
    killallServers(servers)
  })
})
