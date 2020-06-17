/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { getMaxBitrate, Video, VideoDetails, VideoResolution } from '../../../shared/models/videos'
import {
  cleanupTests,
  doubleFollow,
  execCLI,
  flushAndRunMultipleServers,
  generateHighBitrateVideo,
  getEnvCli,
  getVideo,
  getVideosList,
  root,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideo,
  viewVideo,
  wait
} from '../../../shared/extra-utils'
import { waitJobs } from '../../../shared/extra-utils/server/jobs'
import { getVideoFileBitrate, getVideoFileFPS, getVideoFileResolution } from '../../helpers/ffmpeg-utils'
import { VIDEO_TRANSCODING_FPS } from '../../initializers/constants'
import { join } from 'path'

const expect = chai.expect

describe('Test optimize old videos', function () {
  let servers: ServerInfo[] = []

  before(async function () {
    this.timeout(200000)

    // Run server 2 to have transcoding enabled
    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    let tempFixturePath: string

    {
      tempFixturePath = await generateHighBitrateVideo()

      const bitrate = await getVideoFileBitrate(tempFixturePath)
      expect(bitrate).to.be.above(getMaxBitrate(VideoResolution.H_1080P, 25, VIDEO_TRANSCODING_FPS))
    }

    // Upload two videos for our needs
    await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video1', fixture: tempFixturePath })
    await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video2', fixture: tempFixturePath })

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

  it('Should run optimize script', async function () {
    this.timeout(200000)

    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run optimize-old-videos`)

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideosList(server.url)
      const videos: Video[] = res.body.data

      expect(videos).to.have.lengthOf(2)

      for (const video of videos) {
        await viewVideo(server.url, video.uuid)

        // Refresh video
        await waitJobs(servers)
        await wait(5000)
        await waitJobs(servers)

        const res2 = await getVideo(server.url, video.uuid)
        const videosDetails: VideoDetails = res2.body

        expect(videosDetails.files).to.have.lengthOf(1)
        const file = videosDetails.files[0]

        expect(file.size).to.be.below(8000000)

        const path = join(root(), 'test' + servers[0].internalServerNumber, 'videos', video.uuid + '-' + file.resolution.id + '.mp4')
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
