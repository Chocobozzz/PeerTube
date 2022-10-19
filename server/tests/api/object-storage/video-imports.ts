/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { expectStartWith, FIXTURE_URLS } from '@server/tests/shared'
import { areMockObjectStorageTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode, VideoPrivacy } from '@shared/models'
import {
  createSingleServer,
  killallServers,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'

async function importVideo (server: PeerTubeServer) {
  const attributes = {
    name: 'import 2',
    privacy: VideoPrivacy.PUBLIC,
    channelId: server.store.channel.id,
    targetUrl: FIXTURE_URLS.goodVideo720
  }

  const { video: { uuid } } = await server.imports.importVideo({ attributes })

  return uuid
}

describe('Object storage for video import', function () {
  if (areMockObjectStorageTestsDisabled()) return

  let server: PeerTubeServer

  before(async function () {
    this.timeout(120000)

    await ObjectStorageCommand.prepareDefaultMockBuckets()

    server = await createSingleServer(1, ObjectStorageCommand.getDefaultMockConfig())

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableImports()
  })

  describe('Without transcoding', async function () {

    before(async function () {
      await server.config.disableTranscoding()
    })

    it('Should import a video and have sent it to object storage', async function () {
      this.timeout(120000)

      const uuid = await importVideo(server)
      await waitJobs(server)

      const video = await server.videos.get({ id: uuid })

      expect(video.files).to.have.lengthOf(1)
      expect(video.streamingPlaylists).to.have.lengthOf(0)

      const fileUrl = video.files[0].fileUrl
      expectStartWith(fileUrl, ObjectStorageCommand.getMockWebTorrentBaseUrl())

      await makeRawRequest({ url: fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('With transcoding', async function () {

    before(async function () {
      await server.config.enableTranscoding()
    })

    it('Should import a video and have sent it to object storage', async function () {
      this.timeout(120000)

      const uuid = await importVideo(server)
      await waitJobs(server)

      const video = await server.videos.get({ id: uuid })

      expect(video.files).to.have.lengthOf(5)
      expect(video.streamingPlaylists).to.have.lengthOf(1)
      expect(video.streamingPlaylists[0].files).to.have.lengthOf(5)

      for (const file of video.files) {
        expectStartWith(file.fileUrl, ObjectStorageCommand.getMockWebTorrentBaseUrl())

        await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      for (const file of video.streamingPlaylists[0].files) {
        expectStartWith(file.fileUrl, ObjectStorageCommand.getMockPlaylistBaseUrl())

        await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }
    })
  })

  after(async function () {
    await killallServers([ server ])
  })
})
