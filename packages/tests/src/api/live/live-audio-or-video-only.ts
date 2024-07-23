/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { Video, VideoResolution } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests, createMultipleServers,
  doubleFollow,
  findExternalSavedVideo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs,
  waitUntilLivePublishedOnAllServers,
  waitUntilLiveReplacedByReplayOnAllServers,
  waitUntilLiveWaitingOnAllServers
} from '@peertube/peertube-server-commands'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'
import { checkLiveCleanup, testLiveVideoResolutions } from '../../shared/live.js'

describe('Test live audio only (input or output)', function () {
  let servers: PeerTubeServer[] = []
  let sqlCommandServer1: SQLCommand

  function updateConf (transcodingEnabled: boolean, resolutions?: number[]) {
    return servers[0].config.enableLive({
      allowReplay: true,
      resolutions: resolutions ?? 'min',
      alwaysTranscodeOriginalResolution: false,
      transcoding: transcodingEnabled,
      maxDuration: -1
    })
  }

  async function runAndCheckAudioLive (options: {
    permanentLive: boolean
    saveReplay: boolean
    transcoded: boolean
    mode: 'video-only' | 'audio-only'
    fixture?: string
    resolutions?: number[]
  }) {
    const { transcoded, permanentLive, saveReplay, mode } = options

    const { video: liveVideo } = await servers[0].live.quickCreate({ permanentLive, saveReplay })

    let fixtureName = options.fixture
    let resolutions = options.resolutions

    if (mode === 'audio-only') {
      if (!fixtureName) fixtureName = 'sample.ogg'
      if (!resolutions) resolutions = [ VideoResolution.H_NOVIDEO ]
    } else if (mode === 'video-only') {
      if (!fixtureName) fixtureName = 'video_short_no_audio.mp4'
      if (!resolutions) resolutions = [ VideoResolution.H_720P ]
    }

    const hasVideo = mode === 'video-only'
    const hasAudio = mode === 'audio-only'

    const ffmpegCommand = await servers[0].live.sendRTMPStreamInVideo({ videoId: liveVideo.uuid, fixtureName })
    await waitUntilLivePublishedOnAllServers(servers, liveVideo.uuid)
    await waitJobs(servers)

    await testLiveVideoResolutions({
      originServer: servers[0],
      sqlCommand: sqlCommandServer1,
      servers,
      liveVideoId: liveVideo.uuid,
      resolutions,
      hasAudio,
      hasVideo,
      transcoded
    })

    await stopFfmpeg(ffmpegCommand)

    return liveVideo
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await servers[0].config.enableMinimumTranscoding()
    await servers[0].config.enableLive({ allowReplay: true, transcoding: true })

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])

    sqlCommandServer1 = new SQLCommand(servers[0])
  })

  describe('Audio input only', function () {
    let liveVideo: Video

    it('Should mux an audio input only', async function () {
      this.timeout(120000)

      await updateConf(false)
      await runAndCheckAudioLive({ mode: 'audio-only', permanentLive: false, saveReplay: false, transcoded: false })
    })

    it('Should correctly handle an audio input only', async function () {
      this.timeout(120000)

      await updateConf(true)
      liveVideo = await runAndCheckAudioLive({ mode: 'audio-only', permanentLive: true, saveReplay: true, transcoded: true })
    })

    it('Should save the replay of an audio input only in a permanent live', async function () {
      this.timeout(120000)

      await waitUntilLiveWaitingOnAllServers(servers, liveVideo.uuid)
      await waitJobs(servers)

      await checkLiveCleanup({ server: servers[0], videoUUID: liveVideo.uuid, permanent: true })

      const video = await findExternalSavedVideo(servers[0], liveVideo.uuid)

      await completeCheckHlsPlaylist({
        hlsOnly: true,
        servers,
        videoUUID: video.uuid,
        resolutions: [ 0 ],
        hasVideo: false,
        splittedAudio: false // audio is not splitted because we only have an audio stream
      })
    })
  })

  describe('Audio output only', function () {
    let liveVideo: Video

    before(async function () {
      await updateConf(true, [ VideoResolution.H_NOVIDEO ])
    })

    it('Should correctly handle an audio output only with an audio input only', async function () {
      this.timeout(120000)

      await runAndCheckAudioLive({ mode: 'audio-only', permanentLive: false, saveReplay: false, transcoded: true })
    })

    it('Should correctly handle an audio output only with a video & audio input', async function () {
      this.timeout(120000)

      liveVideo = await runAndCheckAudioLive({
        mode: 'audio-only',
        fixture: 'video_short.mp4',
        permanentLive: false,
        saveReplay: true,
        transcoded: true
      })
    })

    it('Should save the replay of an audio output only in a normal live', async function () {
      this.timeout(120000)

      await waitUntilLiveReplacedByReplayOnAllServers(servers, liveVideo.uuid)
      await waitJobs(servers)

      await checkLiveCleanup({ server: servers[0], videoUUID: liveVideo.uuid, permanent: false, savedResolutions: [ 0 ] })

      await completeCheckHlsPlaylist({
        hlsOnly: true,
        servers,
        videoUUID: liveVideo.uuid,
        resolutions: [ 0 ],
        hasVideo: false,
        splittedAudio: false // audio is not splitted because we only have an audio stream
      })
    })

    it('Should handle a video input only even if there is only the audio output', async function () {
      this.timeout(120000)

      await runAndCheckAudioLive({
        mode: 'video-only',
        permanentLive: false,
        saveReplay: false,
        transcoded: true,
        resolutions: [ VideoResolution.H_720P ]
      })
    })
  })

  describe('Video input only', function () {
    let liveVideo: Video

    it('Should correctly handle a video input only', async function () {
      this.timeout(120000)

      await updateConf(true, [ VideoResolution.H_NOVIDEO, VideoResolution.H_240P ])

      liveVideo = await runAndCheckAudioLive({
        mode: 'video-only',
        permanentLive: true,
        saveReplay: true,
        transcoded: true,
        resolutions: [ VideoResolution.H_240P ]
      })
    })

    it('Should save the replay of a video output only in a permanent live', async function () {
      this.timeout(120000)

      await waitUntilLiveWaitingOnAllServers(servers, liveVideo.uuid)
      await waitJobs(servers)

      await checkLiveCleanup({ server: servers[0], videoUUID: liveVideo.uuid, permanent: true })

      const video = await findExternalSavedVideo(servers[0], liveVideo.uuid)

      await completeCheckHlsPlaylist({
        hlsOnly: true,
        servers,
        videoUUID: video.uuid,
        resolutions: [ VideoResolution.H_240P ],
        hasAudio: false,
        splittedAudio: false // audio is not splitted because we only have a video stream
      })
    })
  })

  after(async function () {
    if (sqlCommandServer1) await sqlCommandServer1.cleanup()

    await cleanupTests(servers)
  })
})
