/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, LiveVideoCreate, VideoPrivacy, VideoResolution } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  findExternalSavedVideo,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs,
  waitUntilLivePublishedOnAllServers,
  waitUntilLiveReplacedByReplayOnAllServers,
  waitUntilLiveWaitingOnAllServers
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { testLiveVideoResolutions } from '@tests/shared/live.js'
import { MockObjectStorageProxy } from '@tests/shared/mock-servers/mock-object-storage.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'

async function createLive (server: PeerTubeServer, permanent: boolean) {
  const attributes: LiveVideoCreate = {
    channelId: server.store.channel.id,
    privacy: VideoPrivacy.PUBLIC,
    name: 'my super live',
    saveReplay: true,
    replaySettings: { privacy: VideoPrivacy.PUBLIC },
    permanentLive: permanent
  }

  const { uuid } = await server.live.create({ fields: attributes })

  return uuid
}

async function checkFilesExist (options: {
  servers: PeerTubeServer[]
  videoUUID: string
  numberOfFiles: number
  objectStorage: ObjectStorageCommand
}) {
  const { servers, videoUUID, numberOfFiles, objectStorage } = options

  for (const server of servers) {
    const video = await server.videos.get({ id: videoUUID })

    expect(video.files).to.have.lengthOf(0)
    expect(video.streamingPlaylists).to.have.lengthOf(1)

    const files = video.streamingPlaylists[0].files
    expect(files).to.have.lengthOf(numberOfFiles)

    for (const file of files) {
      expectStartWith(file.fileUrl, objectStorage.getMockPlaylistBaseUrl())

      await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    }
  }
}

async function checkFilesCleanup (options: {
  server: PeerTubeServer
  videoUUID: string
  resolutions: number[]
  objectStorage: ObjectStorageCommand
}) {
  const { server, videoUUID, resolutions, objectStorage } = options

  const resolutionFiles = resolutions.map((_value, i) => `${i}.m3u8`)

  for (const playlistName of [ 'master.m3u8' ].concat(resolutionFiles)) {
    await server.live.getPlaylistFile({
      videoUUID,
      playlistName,
      expectedStatus: HttpStatusCode.NOT_FOUND_404,
      objectStorage
    })
  }

  await server.live.getSegmentFile({
    videoUUID,
    playlistNumber: 0,
    segment: 0,
    objectStorage,
    expectedStatus: HttpStatusCode.NOT_FOUND_404
  })
}

describe('Object storage for lives', function () {
  if (areMockObjectStorageTestsDisabled()) return

  let servers: PeerTubeServer[]
  let sqlCommandServer1: SQLCommand
  const objectStorage = new ObjectStorageCommand()

  before(async function () {
    this.timeout(120000)

    await objectStorage.prepareDefaultMockBuckets()
    servers = await createMultipleServers(2, objectStorage.getDefaultMockConfig())

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscoding()

    sqlCommandServer1 = new SQLCommand(servers[0])
  })

  describe('Without live transcoding', function () {
    let videoUUID: string

    before(async function () {
      await servers[0].config.enableLive({ transcoding: false, allowReplay: true })

      videoUUID = await createLive(servers[0], false)
    })

    it('Should create a live and publish it on object storage', async function () {
      this.timeout(220000)

      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: videoUUID })
      await waitUntilLivePublishedOnAllServers(servers, videoUUID)

      await testLiveVideoResolutions({
        originServer: servers[0],
        sqlCommand: sqlCommandServer1,
        servers,
        liveVideoId: videoUUID,
        resolutions: [ 720 ],
        transcoded: false,
        objectStorage
      })

      await stopFfmpeg(ffmpegCommand)
    })

    it('Should have saved the replay on object storage', async function () {
      this.timeout(220000)

      await waitUntilLiveReplacedByReplayOnAllServers(servers, videoUUID)
      await waitJobs(servers)

      await checkFilesExist({ servers, videoUUID, numberOfFiles: 1, objectStorage })
    })

    it('Should have cleaned up live files from object storage', async function () {
      await checkFilesCleanup({ server: servers[0], videoUUID, resolutions: [ 720 ], objectStorage })
    })
  })

  describe('With live transcoding', function () {
    const resolutions = [ VideoResolution.H_720P, VideoResolution.H_240P ]

    before(async function () {
      await servers[0].config.enableLive({ transcoding: true, resolutions })
    })

    describe('Normal replay', function () {
      let videoUUIDNonPermanent: string

      before(async function () {
        videoUUIDNonPermanent = await createLive(servers[0], false)
      })

      it('Should create a live and publish it on object storage', async function () {
        this.timeout(240000)

        const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: videoUUIDNonPermanent })
        await waitUntilLivePublishedOnAllServers(servers, videoUUIDNonPermanent)

        await testLiveVideoResolutions({
          originServer: servers[0],
          sqlCommand: sqlCommandServer1,
          servers,
          liveVideoId: videoUUIDNonPermanent,
          resolutions,
          transcoded: true,
          objectStorage
        })

        await stopFfmpeg(ffmpegCommand)
      })

      it('Should have saved the replay on object storage', async function () {
        this.timeout(220000)

        await waitUntilLiveReplacedByReplayOnAllServers(servers, videoUUIDNonPermanent)
        await waitJobs(servers)

        const numberOfFiles = resolutions.length + 1 // +1 for the HLS audio file
        await checkFilesExist({ servers, videoUUID: videoUUIDNonPermanent, numberOfFiles, objectStorage })
      })

      it('Should have cleaned up live files from object storage', async function () {
        await checkFilesCleanup({ server: servers[0], videoUUID: videoUUIDNonPermanent, resolutions, objectStorage })
      })
    })

    describe('Permanent replay', function () {
      let videoUUIDPermanent: string

      before(async function () {
        videoUUIDPermanent = await createLive(servers[0], true)
      })

      it('Should create a live and publish it on object storage', async function () {
        this.timeout(240000)

        const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: videoUUIDPermanent })
        await waitUntilLivePublishedOnAllServers(servers, videoUUIDPermanent)

        await testLiveVideoResolutions({
          originServer: servers[0],
          sqlCommand: sqlCommandServer1,
          servers,
          liveVideoId: videoUUIDPermanent,
          resolutions,
          transcoded: true,
          objectStorage
        })

        await stopFfmpeg(ffmpegCommand)
      })

      it('Should have saved the replay on object storage', async function () {
        this.timeout(220000)

        await waitUntilLiveWaitingOnAllServers(servers, videoUUIDPermanent)
        await waitJobs(servers)

        const replay = await findExternalSavedVideo(servers[0], videoUUIDPermanent)

        const numberOfFiles = resolutions.length + 1 // +1 for the HLS audio file
        await checkFilesExist({ servers, videoUUID: replay.uuid, numberOfFiles, objectStorage })
      })

      it('Should have cleaned up live files from object storage', async function () {
        await checkFilesCleanup({ server: servers[0], videoUUID: videoUUIDPermanent, resolutions, objectStorage })
      })
    })
  })

  describe('With object storage base url', function () {
    const mockObjectStorageProxy = new MockObjectStorageProxy()
    let baseMockUrl: string

    before(async function () {
      this.timeout(120000)

      const port = await mockObjectStorageProxy.initialize()
      const bucketName = objectStorage.getMockStreamingPlaylistsBucketName()
      baseMockUrl = `http://127.0.0.1:${port}/${bucketName}`

      await objectStorage.prepareDefaultMockBuckets()

      const config = {
        object_storage: {
          enabled: true,
          endpoint: 'http://' + ObjectStorageCommand.getMockEndpointHost(),
          region: ObjectStorageCommand.getMockRegion(),

          credentials: ObjectStorageCommand.getMockCredentialsConfig(),

          streaming_playlists: {
            bucket_name: bucketName,
            prefix: '',
            base_url: baseMockUrl
          }
        }
      }

      await servers[0].kill()
      await servers[0].run(config)

      await servers[0].config.enableLive({ transcoding: true, resolutions: 'min' })
    })

    it('Should publish a live and replace the base url', async function () {
      this.timeout(240000)

      const videoUUIDPermanent = await createLive(servers[0], true)

      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: videoUUIDPermanent })
      await waitUntilLivePublishedOnAllServers(servers, videoUUIDPermanent)

      await testLiveVideoResolutions({
        originServer: servers[0],
        sqlCommand: sqlCommandServer1,
        servers,
        liveVideoId: videoUUIDPermanent,
        resolutions: [ 720 ],
        transcoded: true,
        objectStorage,
        objectStorageBaseUrl: baseMockUrl
      })

      await stopFfmpeg(ffmpegCommand)
    })
  })

  describe('With live stream to object storage disabled', function () {
    let videoUUID: string

    before(async function () {
      await servers[0].kill()
      await servers[0].run(objectStorage.getDefaultMockConfig({ storeLiveStreams: false }))
      await servers[0].config.enableLive({ transcoding: false })

      videoUUID = await createLive(servers[0], false)
    })

    it('Should create a live and keep it on file system', async function () {
      this.timeout(220000)

      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: videoUUID })
      await waitUntilLivePublishedOnAllServers(servers, videoUUID)

      await testLiveVideoResolutions({
        originServer: servers[0],
        sqlCommand: sqlCommandServer1,
        servers,
        liveVideoId: videoUUID,
        resolutions: [ 720 ],
        transcoded: false,
        objectStorage: undefined
      })

      // Should not have files on object storage
      await checkFilesCleanup({ server: servers[0], videoUUID, resolutions: [ 720 ], objectStorage })

      await stopFfmpeg(ffmpegCommand)
    })

    it('Should have saved the replay on object storage', async function () {
      this.timeout(220000)

      await waitUntilLiveReplacedByReplayOnAllServers(servers, videoUUID)
      await waitJobs(servers)

      await checkFilesExist({ servers, videoUUID, numberOfFiles: 1, objectStorage })
    })
  })

  after(async function () {
    await sqlCommandServer1.cleanup()
    await objectStorage.cleanupMock()

    await cleanupTests(servers)
  })
})
