/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoDetails, VideoFile, VideoInclude } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled, buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  ObjectStorageCommand,
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { expectStartWith } from '../shared/checks.js'

function assertVideoProperties (video: VideoFile, resolution: number, extname: string, size?: number) {
  expect(video).to.have.nested.property('resolution.id', resolution)
  expect(video).to.have.property('torrentUrl').that.includes(`-${resolution}.torrent`)
  expect(video).to.have.property('fileUrl').that.includes(`.${extname}`)
  expect(video).to.have.property('magnetUri').that.includes(`.${extname}`)
  expect(video).to.have.property('size').that.is.above(0)

  if (size) expect(video.size).to.equal(size)
}

async function checkFiles (video: VideoDetails, objectStorage: ObjectStorageCommand) {
  for (const file of video.files) {
    if (objectStorage) expectStartWith(file.fileUrl, objectStorage.getMockWebVideosBaseUrl())

    await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  }
}

function runTests (enableObjectStorage: boolean) {
  let video1ShortId: string
  let video2UUID: string

  let servers: PeerTubeServer[] = []

  const objectStorage = new ObjectStorageCommand()

  before(async function () {
    this.timeout(90000)

    const config = enableObjectStorage
      ? objectStorage.getDefaultMockConfig()
      : {}

    // Run server 2 to have transcoding enabled
    servers = await createMultipleServers(2, config)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    if (enableObjectStorage) await objectStorage.prepareDefaultMockBuckets()

    // Upload two videos for our needs
    {
      const { shortUUID } = await servers[0].videos.upload({ attributes: { name: 'video1' } })
      video1ShortId = shortUUID
    }

    {
      const { uuid } = await servers[1].videos.upload({ attributes: { name: 'video2' } })
      video2UUID = uuid
    }

    await waitJobs(servers)

    for (const server of servers) {
      await server.config.enableTranscoding()
    }
  })

  it('Should run a import job on video 1 with a lower resolution', async function () {
    const command = `npm run create-import-video-file-job -- -v ${video1ShortId} -i ${buildAbsoluteFixturePath('video_short_480.webm')}`
    await servers[0].cli.execWithEnv(command)

    await waitJobs(servers)

    for (const server of servers) {
      const { data: videos } = await server.videos.list()
      expect(videos).to.have.lengthOf(2)

      const video = videos.find(({ shortUUID }) => shortUUID === video1ShortId)
      const videoDetails = await server.videos.get({ id: video.shortUUID })

      expect(videoDetails.files).to.have.lengthOf(2)
      const [ originalVideo, transcodedVideo ] = videoDetails.files
      assertVideoProperties(originalVideo, 720, 'webm', 218910)
      assertVideoProperties(transcodedVideo, 480, 'webm', 69217)

      await checkFiles(videoDetails, enableObjectStorage && objectStorage)
    }
  })

  it('Should run a import job on video 2 with the same resolution and a different extension', async function () {
    const command = `npm run create-import-video-file-job -- -v ${video2UUID} -i ${buildAbsoluteFixturePath('video_short.ogv')}`
    await servers[1].cli.execWithEnv(command)

    await waitJobs(servers)

    for (const server of servers) {
      const { data: videos } = await server.videos.listWithToken({ include: VideoInclude.NOT_PUBLISHED_STATE })
      expect(videos).to.have.lengthOf(2)

      const video = videos.find(({ uuid }) => uuid === video2UUID)
      const videoDetails = await server.videos.get({ id: video.uuid })

      expect(videoDetails.files).to.have.lengthOf(4)
      const [ originalVideo, transcodedVideo420, transcodedVideo320, transcodedVideo240 ] = videoDetails.files
      assertVideoProperties(originalVideo, 720, 'ogv', 140849)
      assertVideoProperties(transcodedVideo420, 480, 'mp4')
      assertVideoProperties(transcodedVideo320, 360, 'mp4')
      assertVideoProperties(transcodedVideo240, 240, 'mp4')

      await checkFiles(videoDetails, enableObjectStorage && objectStorage)
    }
  })

  it('Should run a import job on video 2 with the same resolution and the same extension', async function () {
    const command = `npm run create-import-video-file-job -- -v ${video1ShortId} -i ${buildAbsoluteFixturePath('video_short2.webm')}`
    await servers[0].cli.execWithEnv(command)

    await waitJobs(servers)

    for (const server of servers) {
      const { data: videos } = await server.videos.listWithToken({ include: VideoInclude.NOT_PUBLISHED_STATE })
      expect(videos).to.have.lengthOf(2)

      const video = videos.find(({ shortUUID }) => shortUUID === video1ShortId)
      const videoDetails = await server.videos.get({ id: video.uuid })

      expect(videoDetails.files).to.have.lengthOf(2)
      const [ video720, video480 ] = videoDetails.files
      assertVideoProperties(video720, 720, 'webm', 942961)
      assertVideoProperties(video480, 480, 'webm', 69217)

      await checkFiles(videoDetails, enableObjectStorage && objectStorage)
    }
  })

  it('Should not have run transcoding after an import job', async function () {
    const { data } = await servers[0].jobs.list({ jobType: 'video-transcoding' })
    expect(data).to.have.lengthOf(0)
  })

  after(async function () {
    await objectStorage.cleanupMock()

    await cleanupTests(servers)
  })
}

describe('Test create import video jobs CLI', function () {

  describe('On filesystem', function () {
    runTests(false)
  })

  describe('On object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    runTests(true)
  })
})
