/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getAllFiles } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoDetails } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  ObjectStorageCommand,
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  getRedirectionUrl,
  makeRawRequest,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkDirectoryIsEmpty } from '@tests/shared/directories.js'
import { join } from 'path'
import { expectStartWith } from '../shared/checks.js'

async function checkFiles (options: {
  origin: PeerTubeServer
  video: VideoDetails
  objectStorage?: ObjectStorageCommand
}) {
  const { origin, video, objectStorage } = options

  // Web videos
  for (const file of video.files) {
    const start = objectStorage
      ? objectStorage.getMockWebVideosBaseUrl()
      : origin.url

    expectStartWith(file.fileUrl, start)

    await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  }

  // Playlists
  {
    const start = objectStorage
      ? objectStorage.getMockPlaylistBaseUrl()
      : origin.url

    const hls = video.streamingPlaylists[0]
    expectStartWith(hls.playlistUrl, start)
    expectStartWith(hls.segmentsSha256Url, start)

    for (const file of hls.files) {
      expectStartWith(file.fileUrl, start)

      await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    }
  }

  // Original file
  {
    const source = await origin.videos.getSource({ id: video.uuid })

    if (objectStorage) {
      await makeRawRequest({ url: source.fileDownloadUrl, token: origin.accessToken, expectedStatus: HttpStatusCode.FOUND_302 })

      const redirected = await getRedirectionUrl(source.fileDownloadUrl, origin.accessToken)
      expectStartWith(redirected, objectStorage.getMockOriginalFileBaseUrl())
    } else {
      await makeRawRequest({ url: source.fileDownloadUrl, token: origin.accessToken, expectedStatus: HttpStatusCode.OK_200 })
      expectStartWith(source.fileDownloadUrl, origin.url)
    }
  }

  // Captions
  {
    const start = objectStorage
      ? objectStorage.getMockCaptionFileBaseUrl()
      : origin.url

    const { data: captions } = await origin.captions.list({ videoId: video.uuid })

    for (const caption of captions) {
      expectStartWith(caption.fileUrl, start)

      await makeRawRequest({ url: caption.fileUrl, token: origin.accessToken, expectedStatus: HttpStatusCode.OK_200 })
    }
  }
}

describe('Test create move video storage job CLI', function () {
  if (areMockObjectStorageTestsDisabled()) return

  let servers: PeerTubeServer[] = []
  const uuids: string[] = []
  const objectStorage = new ObjectStorageCommand()

  before(async function () {
    this.timeout(360000)

    // Run server 2 to have transcoding enabled
    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    await objectStorage.prepareDefaultMockBuckets()

    await servers[0].config.enableMinimumTranscoding({ keepOriginal: true })

    for (let i = 0; i < 3; i++) {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'video' + i })

      await servers[0].captions.add({ language: 'ar', videoId: uuid, fixture: 'subtitle-good1.vtt' })
      await servers[0].captions.add({ language: 'zh', videoId: uuid, fixture: 'subtitle-good1.vtt' })

      uuids.push(uuid)
    }

    await waitJobs(servers)

    await servers[0].kill()
    await servers[0].run(objectStorage.getDefaultMockConfig())
  })

  describe('To object storage', function () {

    it('Should move only one file', async function () {
      this.timeout(120000)

      const command = `npm run create-move-video-storage-job -- --to-object-storage -v ${uuids[1]}`
      await servers[0].cli.execWithEnv(command, objectStorage.getDefaultMockConfig())
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuids[1] })

        await checkFiles({ origin: servers[0], video, objectStorage })

        for (const id of [ uuids[0], uuids[2] ]) {
          const video = await server.videos.get({ id })

          await checkFiles({ origin: servers[0], video })
        }
      }
    })

    it('Should move all files', async function () {
      this.timeout(120000)

      const command = `npm run create-move-video-storage-job -- --to-object-storage --all-videos`
      await servers[0].cli.execWithEnv(command, objectStorage.getDefaultMockConfig())
      await waitJobs(servers)

      for (const server of servers) {
        for (const id of [ uuids[0], uuids[2] ]) {
          const video = await server.videos.get({ id })

          await checkFiles({ origin: servers[0], video, objectStorage })
        }
      }
    })

    it('Should not have files on disk anymore', async function () {
      await checkDirectoryIsEmpty(servers[0], 'web-videos', [ 'private' ])
      await checkDirectoryIsEmpty(servers[0], join('web-videos', 'private'))

      await checkDirectoryIsEmpty(servers[0], join('streaming-playlists', 'hls'), [ 'private' ])
      await checkDirectoryIsEmpty(servers[0], join('streaming-playlists', 'hls', 'private'))
    })
  })

  describe('To file system', function () {
    let oldFileUrls: string[]

    before(async function () {
      const video = await servers[0].videos.get({ id: uuids[1] })

      oldFileUrls = [
        ...getAllFiles(video).map(f => f.fileUrl),
        video.streamingPlaylists[0].playlistUrl
      ]
    })

    it('Should move only one file', async function () {
      this.timeout(120000)

      const command = `npm run create-move-video-storage-job -- --to-file-system -v ${uuids[1]}`
      await servers[0].cli.execWithEnv(command, objectStorage.getDefaultMockConfig())
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: uuids[1] })

        await checkFiles({ origin: servers[0], video })

        for (const id of [ uuids[0], uuids[2] ]) {
          const video = await server.videos.get({ id })

          await checkFiles({ origin: servers[0], video, objectStorage })
        }
      }
    })

    it('Should move all files', async function () {
      this.timeout(120000)

      const command = `npm run create-move-video-storage-job -- --to-file-system --all-videos`
      await servers[0].cli.execWithEnv(command, objectStorage.getDefaultMockConfig())
      await waitJobs(servers)

      for (const server of servers) {
        for (const id of [ uuids[0], uuids[2] ]) {
          const video = await server.videos.get({ id })

          await checkFiles({ origin: servers[0], video })
        }
      }
    })

    it('Should not have files on disk anymore', async function () {
      for (const fileUrl of oldFileUrls) {
        await makeRawRequest({ url: fileUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      }
    })
  })

  after(async function () {
    await objectStorage.cleanupMock()

    await cleanupTests(servers)
  })
})
