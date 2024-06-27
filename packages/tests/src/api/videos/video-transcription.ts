/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoPrivacy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  sendRTMPStream,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  stopFfmpeg,
  waitJobs
} from '@peertube/peertube-server-commands'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { checkAutoCaption, checkLanguage, checkNoCaption, uploadForTranscription } from '@tests/shared/transcription.js'

describe('Test video transcription', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await waitJobs(servers)
    await waitJobs(servers)
  })

  // ---------------------------------------------------------------------------

  it('Should generate a transcription on request', async function () {
    this.timeout(360000)

    await servers[0].config.disableTranscription()

    const uuid = await uploadForTranscription(servers[0])
    await waitJobs(servers)
    await checkLanguage(servers, uuid, null)

    await servers[0].config.enableTranscription()

    await servers[0].captions.runGenerate({ videoId: uuid })
    await waitJobs(servers)
    await checkLanguage(servers, uuid, 'en')

    await checkAutoCaption(servers, uuid)
  })

  it('Should run transcription on upload by default', async function () {
    this.timeout(360000)

    const uuid = await uploadForTranscription(servers[0])

    await waitJobs(servers)
    await checkAutoCaption(servers, uuid)
    await checkLanguage(servers, uuid, 'en')
  })

  it('Should run transcription on import by default', async function () {
    this.timeout(360000)

    const { video } = await servers[0].videoImports.importVideo({
      attributes: {
        privacy: VideoPrivacy.PUBLIC,
        targetUrl: FIXTURE_URLS.transcriptionVideo,
        language: undefined
      }
    })

    await waitJobs(servers)
    await checkAutoCaption(servers, video.uuid)
    await checkLanguage(servers, video.uuid, 'en')
  })

  it('Should run transcription when live ended', async function () {
    this.timeout(360000)

    await servers[0].config.enableMinimumTranscoding()
    await servers[0].config.enableLive({ allowReplay: true, transcoding: true, resolutions: 'min' })

    const { live, video } = await servers[0].live.quickCreate({
      saveReplay: true,
      permanentLive: false,
      privacy: VideoPrivacy.PUBLIC
    })

    const ffmpegCommand = sendRTMPStream({ rtmpBaseUrl: live.rtmpUrl, streamKey: live.streamKey })
    await servers[0].live.waitUntilPublished({ videoId: video.id })

    await stopFfmpeg(ffmpegCommand)

    await servers[0].live.waitUntilReplacedByReplay({ videoId: video.id })
    await waitJobs(servers)
    await checkAutoCaption(servers, video.uuid, 'WEBVTT\n\n00:')
    await checkLanguage(servers, video.uuid, 'en')

    await servers[0].config.enableLive({ allowReplay: false })
    await servers[0].config.disableTranscoding()
  })

  it('Should not run transcription if disabled by user', async function () {
    this.timeout(120000)

    {
      const uuid = await uploadForTranscription(servers[0], { generateTranscription: false })

      await waitJobs(servers)
      await checkNoCaption(servers, uuid)
      await checkLanguage(servers, uuid, null)
    }

    {
      const { video } = await servers[0].videoImports.importVideo({
        attributes: {
          privacy: VideoPrivacy.PUBLIC,
          targetUrl: FIXTURE_URLS.transcriptionVideo,
          generateTranscription: false
        }
      })

      await waitJobs(servers)
      await checkNoCaption(servers, video.uuid)
      await checkLanguage(servers, video.uuid, null)
    }
  })

  it('Should not run a transcription if the video does not contain audio', async function () {
    this.timeout(120000)

    const uuid = await uploadForTranscription(servers[0], { generateTranscription: false })

    await waitJobs(servers)
    await checkNoCaption(servers, uuid)
    await checkLanguage(servers, uuid, null)
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
