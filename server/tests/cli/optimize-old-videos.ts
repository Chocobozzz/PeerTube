/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  generateHighBitrateVideo,
  PeerTubeServer,
  setAccessTokensToServers,
  wait,
  waitJobs
} from '@shared/extra-utils'
import { getMaxBitrate, VideoResolution } from '@shared/models'
import { getVideoFileBitrate, getVideoFileFPS, getVideoFileResolution } from '../../helpers/ffprobe-utils'
import { VIDEO_TRANSCODING_FPS } from '../../initializers/constants'

const expect = chai.expect

describe('Test optimize old videos', function () {
  let servers: PeerTubeServer[] = []

  before(async function () {
    this.timeout(200000)

    // Run server 2 to have transcoding enabled
    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    let tempFixturePath: string

    {
      tempFixturePath = await generateHighBitrateVideo()

      const bitrate = await getVideoFileBitrate(tempFixturePath)
      expect(bitrate).to.be.above(getMaxBitrate(VideoResolution.H_1080P, 25, VIDEO_TRANSCODING_FPS))
    }

    // Upload two videos for our needs
    await servers[0].videos.upload({ attributes: { name: 'video1', fixture: tempFixturePath } })
    await servers[0].videos.upload({ attributes: { name: 'video2', fixture: tempFixturePath } })

    await waitJobs(servers)
  })

  it('Should have two video files on each server', async function () {
    this.timeout(30000)

    for (const server of servers) {
      const { data } = await server.videos.list()
      expect(data).to.have.lengthOf(2)

      for (const video of data) {
        const videoDetails = await server.videos.get({ id: video.uuid })
        expect(videoDetails.files).to.have.lengthOf(1)
      }
    }
  })

  it('Should run optimize script', async function () {
    this.timeout(200000)

    await servers[0].cli.execWithEnv('npm run optimize-old-videos')
    await waitJobs(servers)

    for (const server of servers) {
      const { data } = await server.videos.list()
      expect(data).to.have.lengthOf(2)

      for (const video of data) {
        await server.videos.view({ id: video.uuid })

        // Refresh video
        await waitJobs(servers)
        await wait(5000)
        await waitJobs(servers)

        const videoDetails = await server.videos.get({ id: video.uuid })

        expect(videoDetails.files).to.have.lengthOf(1)
        const file = videoDetails.files[0]

        expect(file.size).to.be.below(8000000)

        const path = servers[0].servers.buildWebTorrentFilePath(file.fileUrl)
        const bitrate = await getVideoFileBitrate(path)
        const fps = await getVideoFileFPS(path)
        const resolution = await getVideoFileResolution(path)

        expect(resolution.videoFileResolution).to.equal(file.resolution.id)
        expect(bitrate).to.be.below(getMaxBitrate(resolution.videoFileResolution, fps, VIDEO_TRANSCODING_FPS))
      }
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
