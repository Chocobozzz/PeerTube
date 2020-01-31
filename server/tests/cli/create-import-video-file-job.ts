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
  uploadVideo
} from '../../../shared/extra-utils'
import { waitJobs } from '../../../shared/extra-utils/server/jobs'
import { VideoFile } from '@shared/models/videos/video-file.model'

const expect = chai.expect

function assertVideoProperties (video: VideoFile, resolution: number, extname: string, size?: number) {
  expect(video).to.have.nested.property('resolution.id', resolution)
  expect(video).to.have.property('magnetUri').that.includes(`.${extname}`)
  expect(video).to.have.property('torrentUrl').that.includes(`-${resolution}.torrent`)
  expect(video).to.have.property('fileUrl').that.includes(`.${extname}`)
  expect(video).to.have.property('size').that.is.above(0)

  if (size) expect(video.size).to.equal(size)
}

describe('Test create import video jobs', function () {
  this.timeout(60000)

  let servers: ServerInfo[] = []
  let video1UUID: string
  let video2UUID: string

  before(async function () {
    this.timeout(90000)

    // Run server 2 to have transcoding enabled
    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    // Upload two videos for our needs
    const res1 = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video1' })
    video1UUID = res1.body.video.uuid
    const res2 = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video2' })
    video2UUID = res2.body.video.uuid

    // Transcoding
    await waitJobs(servers)
  })

  it('Should run a import job on video 1 with a lower resolution', async function () {
    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-import-video-file-job -- -v ${video1UUID} -i server/tests/fixtures/video_short-480.webm`)

    await waitJobs(servers)

    let magnetUri: string
    for (const server of servers) {
      const { data: videos } = (await getVideosList(server.url)).body
      expect(videos).to.have.lengthOf(2)

      const video = videos.find(({ uuid }) => uuid === video1UUID)
      const videoDetail: VideoDetails = (await getVideo(server.url, video.uuid)).body

      expect(videoDetail.files).to.have.lengthOf(2)
      const [ originalVideo, transcodedVideo ] = videoDetail.files
      assertVideoProperties(originalVideo, 720, 'webm', 218910)
      assertVideoProperties(transcodedVideo, 480, 'webm', 69217)

      if (!magnetUri) magnetUri = transcodedVideo.magnetUri
      else expect(transcodedVideo.magnetUri).to.equal(magnetUri)
    }
  })

  it('Should run a import job on video 2 with the same resolution and a different extension', async function () {
    const env = getEnvCli(servers[1])
    await execCLI(`${env} npm run create-import-video-file-job -- -v ${video2UUID} -i server/tests/fixtures/video_short.ogv`)

    await waitJobs(servers)

    let magnetUri: string
    for (const server of servers) {
      const { data: videos } = (await getVideosList(server.url)).body
      expect(videos).to.have.lengthOf(2)

      const video = videos.find(({ uuid }) => uuid === video2UUID)
      const videoDetail: VideoDetails = (await getVideo(server.url, video.uuid)).body

      expect(videoDetail.files).to.have.lengthOf(4)
      const [ originalVideo, transcodedVideo420, transcodedVideo320, transcodedVideo240 ] = videoDetail.files
      assertVideoProperties(originalVideo, 720, 'ogv', 140849)
      assertVideoProperties(transcodedVideo420, 480, 'mp4')
      assertVideoProperties(transcodedVideo320, 360, 'mp4')
      assertVideoProperties(transcodedVideo240, 240, 'mp4')

      if (!magnetUri) magnetUri = originalVideo.magnetUri
      else expect(originalVideo.magnetUri).to.equal(magnetUri)
    }
  })

  it('Should run a import job on video 2 with the same resolution and the same extension', async function () {
    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-import-video-file-job -- -v ${video1UUID} -i server/tests/fixtures/video_short2.webm`)

    await waitJobs(servers)

    let magnetUri: string
    for (const server of servers) {
      const { data: videos } = (await getVideosList(server.url)).body
      expect(videos).to.have.lengthOf(2)

      const video = videos.find(({ uuid }) => uuid === video1UUID)
      const videoDetail: VideoDetails = (await getVideo(server.url, video.uuid)).body

      expect(videoDetail.files).to.have.lengthOf(2)
      const [ video720, video480 ] = videoDetail.files
      assertVideoProperties(video720, 720, 'webm', 942961)
      assertVideoProperties(video480, 480, 'webm', 69217)

      if (!magnetUri) magnetUri = video720.magnetUri
      else expect(video720.magnetUri).to.equal(magnetUri)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
