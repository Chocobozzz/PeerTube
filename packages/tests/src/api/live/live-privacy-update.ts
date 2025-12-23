/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, LiveVideoCreate, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  findExternalSavedVideo,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs,
  waitUntilLivePublishedOnAllServers,
  waitUntilLiveReplacedByReplayOnAllServers,
  waitUntilLiveWaitingOnAllServers
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

async function testVideoFiles (options: {
  server: PeerTubeServer
  uuid: string
  isPrivate: boolean
}) {
  const { server, uuid, isPrivate } = options

  const video = await server.videos.getWithToken({ id: uuid })
  const playlist = video.streamingPlaylists[0]

  const urls = [ playlist.playlistUrl, playlist.segmentsSha256Url ]

  for (const url of urls) {
    await makeRawRequest({ url, token: server.accessToken, expectedStatus: HttpStatusCode.OK_200 })

    if (isPrivate) {
      expect(url).to.not.include('/private/')
    } else {
      expect(url).to.include('/private/')
    }
  }
}

describe('Live privacy update', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableMinimumTranscoding()
    await server.config.enableLive({ allowReplay: true, transcoding: true, resolutions: 'min' })
  })

  describe('Normal live', function () {
    let uuid: string

    it('Should create a public live with private replay', async function () {
      this.timeout(120000)

      const fields: LiveVideoCreate = {
        name: 'normal live',
        privacy: VideoPrivacy.PUBLIC,
        permanentLive: false,
        replaySettings: { privacy: VideoPrivacy.PRIVATE },
        saveReplay: true,
        channelId: server.store.channel.id
      }

      const video = await server.live.create({ fields })
      uuid = video.uuid

      const ffmpegCommand = await server.live.sendRTMPStreamInVideo({ videoId: uuid })
      await waitUntilLivePublishedOnAllServers([ server ], uuid)
      await stopFfmpeg(ffmpegCommand)

      await waitUntilLiveReplacedByReplayOnAllServers([ server ], uuid)
      await waitJobs([ server ])

      await testVideoFiles({ server, uuid, isPrivate: false })
    })

    it('Should update the replay to public and re-update it to private', async function () {
      this.timeout(120000)

      await server.videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })
      await waitJobs([ server ])
      await testVideoFiles({ server, uuid, isPrivate: true })

      await server.videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PRIVATE } })
      await waitJobs([ server ])
      await testVideoFiles({ server, uuid, isPrivate: false })
    })
  })

  describe('Permanent live', function () {
    let liveUUID: string

    it('Should update the permanent live privacy but still process the replay', async function () {
      this.timeout(120000)

      const fields: LiveVideoCreate = {
        name: 'permanent live',
        privacy: VideoPrivacy.PUBLIC,
        permanentLive: true,
        replaySettings: { privacy: VideoPrivacy.PUBLIC },
        saveReplay: true,
        channelId: server.store.channel.id
      }

      const video = await server.live.create({ fields })
      liveUUID = video.uuid

      const ffmpegCommand = await server.live.sendRTMPStreamInVideo({ videoId: liveUUID })
      await waitUntilLivePublishedOnAllServers([ server ], liveUUID)
      await stopFfmpeg(ffmpegCommand)
      await waitUntilLiveWaitingOnAllServers([ server ], liveUUID)

      await server.videos.update({ id: liveUUID, attributes: { privacy: VideoPrivacy.PRIVATE } })
      await waitJobs([ server ])

      const replay = await findExternalSavedVideo(server, liveUUID)
      expect(replay).to.exist

      await testVideoFiles({ server, uuid: replay.uuid, isPrivate: true })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
