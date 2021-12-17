/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { FfmpegCommand } from 'fluent-ffmpeg'
import { expectStartWith } from '@server/tests/shared'
import { areObjectStorageTestsDisabled } from '@shared/core-utils'
import { HttpStatusCode, LiveVideoCreate, VideoFile, VideoPrivacy } from '@shared/models'
import {
  createMultipleServers,
  doubleFollow,
  killallServers,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs,
  waitUntilLivePublishedOnAllServers,
  waitUntilLiveSavedOnAllServers
} from '@shared/server-commands'

const expect = chai.expect

async function createLive (server: PeerTubeServer) {
  const attributes: LiveVideoCreate = {
    channelId: server.store.channel.id,
    privacy: VideoPrivacy.PUBLIC,
    name: 'my super live',
    saveReplay: true
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

describe('Object storage for lives', function () {
  if (areObjectStorageTestsDisabled()) return

  let ffmpegCommand: FfmpegCommand
  let servers: PeerTubeServer[]
  let videoUUID: string

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

    before(async function () {
      await servers[0].config.enableLive({ transcoding: false })

      videoUUID = await createLive(servers[0])
    })

    it('Should create a live and save the replay on object storage', async function () {
      this.timeout(220000)

      ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: videoUUID })
      await waitUntilLivePublishedOnAllServers(servers, videoUUID)

      await stopFfmpeg(ffmpegCommand)

      await waitUntilLiveSavedOnAllServers(servers, videoUUID)
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })

        expect(video.files).to.have.lengthOf(0)
        expect(video.streamingPlaylists).to.have.lengthOf(1)

        const files = video.streamingPlaylists[0].files

        await checkFiles(files)
      }
    })
  })

  describe('With live transcoding', async function () {

    before(async function () {
      await servers[0].config.enableLive({ transcoding: true })

      videoUUID = await createLive(servers[0])
    })

    it('Should import a video and have sent it to object storage', async function () {
      this.timeout(240000)

      ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: videoUUID })
      await waitUntilLivePublishedOnAllServers(servers, videoUUID)

      await stopFfmpeg(ffmpegCommand)

      await waitUntilLiveSavedOnAllServers(servers, videoUUID)
      await waitJobs(servers)

      for (const server of servers) {
        const video = await server.videos.get({ id: videoUUID })

        expect(video.files).to.have.lengthOf(0)
        expect(video.streamingPlaylists).to.have.lengthOf(1)

        const files = video.streamingPlaylists[0].files
        expect(files).to.have.lengthOf(5)

        await checkFiles(files)
      }
    })
  })

  after(async function () {
    await killallServers(servers)
  })
})
