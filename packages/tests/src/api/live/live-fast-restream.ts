/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { LiveVideoCreate, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Fast restream in live', function () {
  let server: PeerTubeServer

  async function createLiveWrapper (options: { permanent: boolean, replay: boolean }) {
    const attributes: LiveVideoCreate = {
      channelId: server.store.channel.id,
      privacy: VideoPrivacy.PUBLIC,
      name: 'my super live',
      saveReplay: options.replay,
      replaySettings: options.replay ? { privacy: VideoPrivacy.PUBLIC } : undefined,
      permanentLive: options.permanent
    }

    const { uuid } = await server.live.create({ fields: attributes })
    return uuid
  }

  async function fastRestreamWrapper ({ replay }: { replay: boolean }) {
    const liveVideoUUID = await createLiveWrapper({ permanent: true, replay })
    await waitJobs([ server ])

    const rtmpOptions = {
      videoId: liveVideoUUID,
      copyCodecs: true,
      fixtureName: 'video_short.mp4'
    }

    // Streaming session #1
    let ffmpegCommand = await server.live.sendRTMPStreamInVideo(rtmpOptions)
    await server.live.waitUntilPublished({ videoId: liveVideoUUID })

    const video = await server.videos.get({ id: liveVideoUUID })
    const session1PlaylistId = video.streamingPlaylists[0].id

    await stopFfmpeg(ffmpegCommand)
    await server.live.waitUntilWaiting({ videoId: liveVideoUUID })

    // Streaming session #2
    ffmpegCommand = await server.live.sendRTMPStreamInVideo(rtmpOptions)

    let hasNewPlaylist = false
    do {
      const video = await server.videos.get({ id: liveVideoUUID })
      hasNewPlaylist = video.streamingPlaylists.length === 1 && video.streamingPlaylists[0].id !== session1PlaylistId

      await wait(100)
    } while (!hasNewPlaylist)

    await server.live.waitUntilSegmentGeneration({
      server,
      videoUUID: liveVideoUUID,
      segment: 1,
      playlistNumber: 0
    })

    return { ffmpegCommand, liveVideoUUID }
  }

  async function ensureLastLiveWorks (liveId: string) {
    // Equivalent to PEERTUBE_TEST_CONSTANTS_VIDEO_LIVE_CLEANUP_DELAY
    for (let i = 0; i < 100; i++) {
      const video = await server.videos.get({ id: liveId })
      expect(video.streamingPlaylists).to.have.lengthOf(1)

      try {
        await server.live.getSegmentFile({ videoUUID: liveId, segment: 0, playlistNumber: 0 })
        await server.streamingPlaylists.get({ url: video.streamingPlaylists[0].playlistUrl })
        await server.streamingPlaylists.getSegmentSha256({ url: video.streamingPlaylists[0].segmentsSha256Url })
      } catch (err) {
        // FIXME: try to debug error in CI "Unexpected end of JSON input"
        console.error(err)
        throw err
      }

      await wait(100)
    }
  }

  async function runTest (replay: boolean) {
    const { ffmpegCommand, liveVideoUUID } = await fastRestreamWrapper({ replay })

    await ensureLastLiveWorks(liveVideoUUID)

    await stopFfmpeg(ffmpegCommand)
    await server.live.waitUntilWaiting({ videoId: liveVideoUUID })

    // Wait for replays
    await waitJobs([ server ])

    const { total, data: sessions } = await server.live.listSessions({ videoId: liveVideoUUID })

    expect(total).to.equal(2)
    expect(sessions).to.have.lengthOf(2)

    for (const session of sessions) {
      expect(session.error).to.be.null

      if (replay) {
        expect(session.replayVideo).to.exist

        await server.videos.get({ id: session.replayVideo.uuid })
      } else {
        expect(session.replayVideo).to.not.exist
      }
    }
  }

  before(async function () {
    this.timeout(120000)

    const env = { PEERTUBE_TEST_CONSTANTS_VIDEO_LIVE_CLEANUP_DELAY: '10000' }
    server = await createSingleServer(1, {}, { env })

    // Get the access tokens
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    await server.config.enableMinimumTranscoding({ webVideo: false, hls: true })
    await server.config.enableLive({ allowReplay: true, transcoding: true, resolutions: 'min' })
  })

  it('Should correctly fast restream in a permanent live with and without save replay', async function () {
    this.timeout(480000)

    // A test can take a long time, so prefer to run them in parallel
    await Promise.all([
      runTest(true),
      runTest(false)
    ])
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
