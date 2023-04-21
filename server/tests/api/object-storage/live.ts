/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { expectStartWith, MockObjectStorageProxy, SQLCommand, testLiveVideoResolutions } from '@server/tests/shared'
import { areMockObjectStorageTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode, LiveVideoCreate, VideoPrivacy } from '@shared/models'
import {
  createMultipleServers,
  doubleFollow,
  findExternalSavedVideo,
  killallServers,
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
} from '@shared/server-commands'

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

async function checkFilesExist (servers: PeerTubeServer[], videoUUID: string, numberOfFiles: number) {
  for (const server of servers) {
    const video = await server.videos.get({ id: videoUUID })

    expect(video.files).to.have.lengthOf(0)
    expect(video.streamingPlaylists).to.have.lengthOf(1)

    const files = video.streamingPlaylists[0].files
    expect(files).to.have.lengthOf(numberOfFiles)

    for (const file of files) {
      expectStartWith(file.fileUrl, ObjectStorageCommand.getMockPlaylistBaseUrl())

      await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    }
  }
}

async function checkFilesCleanup (server: PeerTubeServer, videoUUID: string, resolutions: number[]) {
  const resolutionFiles = resolutions.map((_value, i) => `${i}.m3u8`)

  for (const playlistName of [ 'master.m3u8' ].concat(resolutionFiles)) {
    await server.live.getPlaylistFile({
      videoUUID,
      playlistName,
      expectedStatus: HttpStatusCode.NOT_FOUND_404,
      objectStorage: true
    })
  }

  await server.live.getSegmentFile({
    videoUUID,
    playlistNumber: 0,
    segment: 0,
    objectStorage: true,
    expectedStatus: HttpStatusCode.NOT_FOUND_404
  })
}

describe('Object storage for lives', function () {
  if (areMockObjectStorageTestsDisabled()) return

  let servers: PeerTubeServer[]
  let sqlCommandServer1: SQLCommand

  before(async function () {
    this.timeout(120000)

    await ObjectStorageCommand.prepareDefaultMockBuckets()

    servers = await createMultipleServers(2, ObjectStorageCommand.getDefaultMockConfig())

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscoding()

    sqlCommandServer1 = new SQLCommand(servers[0])
  })

  describe('Without live transcoding', function () {
    let videoUUID: string

    before(async function () {
      await servers[0].config.enableLive({ transcoding: false })

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
        objectStorage: true
      })

      await stopFfmpeg(ffmpegCommand)
    })

    it('Should have saved the replay on object storage', async function () {
      this.timeout(220000)

      await waitUntilLiveReplacedByReplayOnAllServers(servers, videoUUID)
      await waitJobs(servers)

      await checkFilesExist(servers, videoUUID, 1)
    })

    it('Should have cleaned up live files from object storage', async function () {
      await checkFilesCleanup(servers[0], videoUUID, [ 720 ])
    })
  })

  describe('With live transcoding', function () {
    const resolutions = [ 720, 480, 360, 240, 144 ]

    before(async function () {
      await servers[0].config.enableLive({ transcoding: true })
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
          objectStorage: true
        })

        await stopFfmpeg(ffmpegCommand)
      })

      it('Should have saved the replay on object storage', async function () {
        this.timeout(220000)

        await waitUntilLiveReplacedByReplayOnAllServers(servers, videoUUIDNonPermanent)
        await waitJobs(servers)

        await checkFilesExist(servers, videoUUIDNonPermanent, 5)
      })

      it('Should have cleaned up live files from object storage', async function () {
        await checkFilesCleanup(servers[0], videoUUIDNonPermanent, resolutions)
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
          objectStorage: true
        })

        await stopFfmpeg(ffmpegCommand)
      })

      it('Should have saved the replay on object storage', async function () {
        this.timeout(220000)

        await waitUntilLiveWaitingOnAllServers(servers, videoUUIDPermanent)
        await waitJobs(servers)

        const videoLiveDetails = await servers[0].videos.get({ id: videoUUIDPermanent })
        const replay = await findExternalSavedVideo(servers[0], videoLiveDetails)

        await checkFilesExist(servers, replay.uuid, 5)
      })

      it('Should have cleaned up live files from object storage', async function () {
        await checkFilesCleanup(servers[0], videoUUIDPermanent, resolutions)
      })
    })
  })

  describe('With object storage base url', function () {
    const mockObjectStorageProxy = new MockObjectStorageProxy()
    let baseMockUrl: string

    before(async function () {
      this.timeout(120000)

      const port = await mockObjectStorageProxy.initialize()
      baseMockUrl = `http://127.0.0.1:${port}/streaming-playlists`

      await ObjectStorageCommand.createMockBucket('streaming-playlists')

      const config = {
        object_storage: {
          enabled: true,
          endpoint: 'http://' + ObjectStorageCommand.getMockEndpointHost(),
          region: ObjectStorageCommand.getMockRegion(),

          credentials: ObjectStorageCommand.getMockCredentialsConfig(),

          streaming_playlists: {
            bucket_name: 'streaming-playlists',
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
        objectStorage: true,
        objectStorageBaseUrl: baseMockUrl
      })

      await stopFfmpeg(ffmpegCommand)
    })
  })

  after(async function () {
    await sqlCommandServer1.cleanup()

    await killallServers(servers)
  })
})
