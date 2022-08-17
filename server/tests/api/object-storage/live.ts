/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { expectStartWith } from '@server/tests/shared'
import { areObjectStorageTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode, LiveVideoCreate, VideoFile, VideoPrivacy } from '@shared/models'
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

async function checkFiles (files: VideoFile[]) {
  for (const file of files) {
    expectStartWith(file.fileUrl, ObjectStorageCommand.getPlaylistBaseUrl())

    await makeRawRequest(file.fileUrl, HttpStatusCode.OK_200)
  }
}

async function getFiles (server: PeerTubeServer, videoUUID: string) {
  const video = await server.videos.get({ id: videoUUID })

  expect(video.files).to.have.lengthOf(0)
  expect(video.streamingPlaylists).to.have.lengthOf(1)

  return video.streamingPlaylists[0].files
}

async function streamAndEnd (servers: PeerTubeServer[], liveUUID: string) {
  const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveUUID })
  await waitUntilLivePublishedOnAllServers(servers, liveUUID)

  const videoLiveDetails = await servers[0].videos.get({ id: liveUUID })
  const liveDetails = await servers[0].live.get({ videoId: liveUUID })

  await stopFfmpeg(ffmpegCommand)

  if (liveDetails.permanentLive) {
    await waitUntilLiveWaitingOnAllServers(servers, liveUUID)
  } else {
    await waitUntilLiveReplacedByReplayOnAllServers(servers, liveUUID)
  }

  await waitJobs(servers)

  return { videoLiveDetails, liveDetails }
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

    it('Should create a live and save the replay on object storage', async function () {
      this.timeout(220000)

      await streamAndEnd(servers, videoUUID)

      for (const server of servers) {
        const files = await getFiles(server, videoUUID)
        expect(files).to.have.lengthOf(1)

        await checkFiles(files)
      }
    })
  })

  describe('With live transcoding', async function () {
    let videoUUIDPermanent: string
    let videoUUIDNonPermanent: string

    before(async function () {
      await servers[0].config.enableLive({ transcoding: true })

      videoUUIDPermanent = await createLive(servers[0], true)
      videoUUIDNonPermanent = await createLive(servers[0], false)
    })

    it('Should create a live and save the replay on object storage', async function () {
      this.timeout(240000)

      await streamAndEnd(servers, videoUUIDNonPermanent)

      for (const server of servers) {
        const files = await getFiles(server, videoUUIDNonPermanent)
        expect(files).to.have.lengthOf(5)

        await checkFiles(files)
      }
    })

    it('Should create a live and save the replay of permanent live on object storage', async function () {
      this.timeout(240000)

      const { videoLiveDetails } = await streamAndEnd(servers, videoUUIDPermanent)

      const replay = await findExternalSavedVideo(servers[0], videoLiveDetails)

      for (const server of servers) {
        const files = await getFiles(server, replay.uuid)
        expect(files).to.have.lengthOf(5)

        await checkFiles(files)
      }
    })
  })

  after(async function () {
    await killallServers(servers)
  })
})
