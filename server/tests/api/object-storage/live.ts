/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { expectStartWith, testVideoResolutions } from '@server/tests/shared'
import { areObjectStorageTestsDisabled } from '@shared/core-utils'
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
      expectStartWith(file.fileUrl, ObjectStorageCommand.getPlaylistBaseUrl())

      await makeRawRequest(file.fileUrl, HttpStatusCode.OK_200)
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
  if (areObjectStorageTestsDisabled()) return

  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(120000)

    await ObjectStorageCommand.prepareDefaultBuckets()

    servers = await createMultipleServers(2, ObjectStorageCommand.getDefaultConfig())

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscoding()
  })

  describe('Without live transcoding', async function () {
    let videoUUID: string

    before(async function () {
      await servers[0].config.enableLive({ transcoding: false })

      videoUUID = await createLive(servers[0], false)
    })

    it('Should create a live and publish it on object storage', async function () {
      this.timeout(220000)

      const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: videoUUID })
      await waitUntilLivePublishedOnAllServers(servers, videoUUID)

      await testVideoResolutions({
        originServer: servers[0],
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

  describe('With live transcoding', async function () {
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

        await testVideoResolutions({
          originServer: servers[0],
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

        await testVideoResolutions({
          originServer: servers[0],
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

  after(async function () {
    await killallServers(servers)
  })
})
