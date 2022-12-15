/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { areMockObjectStorageTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode, VideoDetails } from '@shared/models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@shared/server-commands'
import { expectStartWith } from '../shared'

async function checkFiles (origin: PeerTubeServer, video: VideoDetails, inObjectStorage: boolean) {
  for (const file of video.files) {
    const start = inObjectStorage
      ? ObjectStorageCommand.getMockWebTorrentBaseUrl()
      : origin.url

    expectStartWith(file.fileUrl, start)

    await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  }

  const start = inObjectStorage
    ? ObjectStorageCommand.getMockPlaylistBaseUrl()
    : origin.url

  const hls = video.streamingPlaylists[0]
  expectStartWith(hls.playlistUrl, start)
  expectStartWith(hls.segmentsSha256Url, start)

  for (const file of hls.files) {
    expectStartWith(file.fileUrl, start)

    await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  }
}

describe('Test create move video storage job', function () {
  if (areMockObjectStorageTestsDisabled()) return

  let servers: PeerTubeServer[] = []
  const uuids: string[] = []

  before(async function () {
    this.timeout(360000)

    // Run server 2 to have transcoding enabled
    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await ObjectStorageCommand.prepareDefaultMockBuckets()

    await servers[0].config.enableTranscoding()

    for (let i = 0; i < 3; i++) {
      const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video' + i } })
      uuids.push(uuid)
    }

    await waitJobs(servers)

    await servers[0].kill()
    await servers[0].run(ObjectStorageCommand.getDefaultMockConfig())
  })

  it('Should move only one file', async function () {
    this.timeout(120000)

    const command = `npm run create-move-video-storage-job -- --to-object-storage -v ${uuids[1]}`
    await servers[0].cli.execWithEnv(command, ObjectStorageCommand.getDefaultMockConfig())
    await waitJobs(servers)

    for (const server of servers) {
      const video = await server.videos.get({ id: uuids[1] })

      await checkFiles(servers[0], video, true)

      for (const id of [ uuids[0], uuids[2] ]) {
        const video = await server.videos.get({ id })

        await checkFiles(servers[0], video, false)
      }
    }
  })

  it('Should move all files', async function () {
    this.timeout(120000)

    const command = `npm run create-move-video-storage-job -- --to-object-storage --all-videos`
    await servers[0].cli.execWithEnv(command, ObjectStorageCommand.getDefaultMockConfig())
    await waitJobs(servers)

    for (const server of servers) {
      for (const id of [ uuids[0], uuids[2] ]) {
        const video = await server.videos.get({ id })

        await checkFiles(servers[0], video, true)
      }
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
