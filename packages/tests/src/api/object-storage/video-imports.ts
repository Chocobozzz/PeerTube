/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { expectStartWith } from '@tests/shared/checks.js'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'

async function importVideo (server: PeerTubeServer) {
  const attributes = {
    name: 'import 2',
    privacy: VideoPrivacy.PUBLIC,
    channelId: server.store.channel.id,
    targetUrl: FIXTURE_URLS.goodVideo720
  }

  const { video: { uuid } } = await server.videoImports.importVideo({ attributes })

  return uuid
}

describe('Object storage for video import', function () {
  if (areMockObjectStorageTestsDisabled()) return

  let server: PeerTubeServer
  const objectStorage = new ObjectStorageCommand()

  before(async function () {
    this.timeout(120000)

    await objectStorage.prepareDefaultMockBuckets()

    server = await createSingleServer(1, objectStorage.getDefaultMockConfig())

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableVideoImports()
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
      expectStartWith(fileUrl, objectStorage.getMockWebVideosBaseUrl())

      await makeRawRequest({ url: fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  describe('With transcoding', async function () {

    before(async function () {
      await server.config.enableTranscoding({ webVideo: true, hls: true, resolutions: 'max' })
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
        expectStartWith(file.fileUrl, objectStorage.getMockWebVideosBaseUrl())

        await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }

      for (const file of video.streamingPlaylists[0].files) {
        expectStartWith(file.fileUrl, objectStorage.getMockPlaylistBaseUrl())

        await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
      }
    })
  })

  after(async function () {
    await objectStorage.cleanupMock()

    await cleanupTests([ server ])
  })
})
