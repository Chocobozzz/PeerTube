/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'
import { VideoDetails, VideoFile } from '../../../shared/models/videos'
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

function assertVideoProperties (video: VideoFile, resolution: number, extname: string) {
  expect(video).to.have.nested.property('resolution.id', resolution)
  expect(video).to.have.property('magnetUri').that.includes(`.${extname}`)
  expect(video).to.have.property('torrentUrl').that.includes(`-${resolution}.torrent`)
  expect(video).to.have.property('fileUrl').that.includes(`.${extname}`)
  expect(video).to.have.property('size').that.is.above(0)
}

describe('Test create import video jobs', function () {
  this.timeout(60000)

  let servers: ServerInfo[] = []
  let video1UUID: string
  let video2UUID: string

  before(async function () {
    this.timeout(90000)
    await flushTests()

    // Run server 2 to have transcoding enabled
    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    // Upload two videos for our needs
    const res1 = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video1' })
    video1UUID = res1.body.video.uuid
    const res2 = await uploadVideo(servers[1].url, servers[1].accessToken, { name: 'video2' })
    video2UUID = res2.body.video.uuid

    await wait(40000)
  })

  it('Should run a import job on video 1 with a lower resolution', async function () {
    const env = getEnvCli(servers[0])
    await execCLI(`${env} npm run create-import-video-file-job -- -v ${video1UUID} -i server/tests/api/fixtures/video_short-480.webm`)

    await wait(30000)

    for (const server of servers) {
      const { data: videos } = (await getVideosList(server.url)).body
      expect(videos).to.have.lengthOf(2)

      let infoHashes: { [ id: number ]: string } = {}

      const video = videos.find(({ uuid }) => uuid === video1UUID)
      const videoDetail: VideoDetails = (await getVideo(server.url, video.uuid)).body

      expect(videoDetail.files).to.have.lengthOf(2)
      const [originalVideo, transcodedVideo] = videoDetail.files
      assertVideoProperties(originalVideo, 720, 'webm')
      assertVideoProperties(transcodedVideo, 480, 'webm')
    }
  })

  it('Should run a import job on video 2 with the same resolution', async function () {
    const env = getEnvCli(servers[1])
    await execCLI(`${env} npm run create-import-video-file-job -- -v ${video2UUID} -i server/tests/api/fixtures/video_short.ogv`)

    await wait(30000)

    for (const server of servers.reverse()) {
      const { data: videos } = (await getVideosList(server.url)).body
      expect(videos).to.have.lengthOf(2)

      let infoHashes: { [ id: number ]: string }

      const video = videos.find(({ uuid }) => uuid === video2UUID)
      const videoDetail: VideoDetails = (await getVideo(server.url, video.uuid)).body

      expect(videoDetail.files).to.have.lengthOf(4)
      const [originalVideo, transcodedVideo420, transcodedVideo320, transcodedVideo240] = videoDetail.files
      assertVideoProperties(originalVideo, 720, 'ogv')
      assertVideoProperties(transcodedVideo420, 480, 'mp4')
      assertVideoProperties(transcodedVideo320, 360, 'mp4')
      assertVideoProperties(transcodedVideo240, 240, 'mp4')
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
