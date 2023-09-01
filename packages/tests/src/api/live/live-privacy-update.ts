/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, LiveVideoCreate, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests, createSingleServer, makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs,
  waitUntilLivePublishedOnAllServers,
  waitUntilLiveReplacedByReplayOnAllServers
} from '@peertube/peertube-server-commands'

async function testVideoFiles (server: PeerTubeServer, uuid: string) {
  const video = await server.videos.getWithToken({ id: uuid })

  const expectedStatus = HttpStatusCode.OK_200

  await makeRawRequest({ url: video.streamingPlaylists[0].playlistUrl, token: server.accessToken, expectedStatus })
  await makeRawRequest({ url: video.streamingPlaylists[0].segmentsSha256Url, token: server.accessToken, expectedStatus })
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
        name: 'live',
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

      await testVideoFiles(server, uuid)
    })

    it('Should update the replay to public and re-update it to private', async function () {
      this.timeout(120000)

      await server.videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })
      await waitJobs([ server ])
      await testVideoFiles(server, uuid)

      await server.videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PRIVATE } })
      await waitJobs([ server ])
      await testVideoFiles(server, uuid)
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
