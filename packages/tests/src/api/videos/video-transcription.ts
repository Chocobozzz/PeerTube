/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoPrivacy } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  ObjectStorageCommand,
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
import { checkAutoCaption, checkLanguage, checkNoCaption, getCaptionContent, uploadForTranscription } from '@tests/shared/transcription.js'
import { expect } from 'chai'
import { join } from 'path'

describe('Test video transcription', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableTranscription()

    await waitJobs(servers)
  })

  // ---------------------------------------------------------------------------

  describe('Common on filesystem', function () {

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

      await checkAutoCaption({ servers, uuid })
    })

    it('Should run transcription on upload by default', async function () {
      this.timeout(360000)

      const uuid = await uploadForTranscription(servers[0])

      await waitJobs(servers)
      await checkAutoCaption({ servers, uuid })
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
      await checkAutoCaption({ servers, uuid: video.uuid })
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

      const ffmpegCommand = sendRTMPStream({
        rtmpBaseUrl: live.rtmpUrl,
        streamKey: live.streamKey,
        fixtureName: join('transcription', 'videos', 'the_last_man_on_earth.mp4')
      })
      await servers[0].live.waitUntilPublished({ videoId: video.id })

      await stopFfmpeg(ffmpegCommand)

      await servers[0].live.waitUntilReplacedByReplay({ videoId: video.id })
      await waitJobs(servers)
      await checkAutoCaption({
        servers,
        uuid: video.uuid,
        captionContains: new RegExp('^WEBVTT\\n\\n00:\\d{2}.\\d{3} --> 00:')
      })
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

      const uuid = await uploadForTranscription(servers[0], { fixture: 'video_short_no_audio.mp4' })

      await waitJobs(servers)
      await checkNoCaption(servers, uuid)
      await checkLanguage(servers, uuid, null)
    })

    it('Should not replace an existing caption', async function () {
      const uuid = await uploadForTranscription(servers[0])

      await servers[0].captions.add({
        language: 'en',
        videoId: uuid,
        fixture: 'subtitle-good1.vtt'
      })

      const contentBefore = await getCaptionContent(servers[0], uuid, 'en')
      await waitJobs(servers)
      const contentAter = await getCaptionContent(servers[0], uuid, 'en')

      expect(contentBefore).to.equal(contentAter)
    })

    it('Should run transcription after a video edition', async function () {
      this.timeout(120000)

      await servers[0].config.enableMinimumTranscoding()
      await servers[0].config.enableStudio()

      const uuid = await uploadForTranscription(servers[0])
      await waitJobs(servers)

      await checkAutoCaption({ servers, uuid })
      const oldContent = await getCaptionContent(servers[0], uuid, 'en')

      await servers[0].videoStudio.createEditionTasks({
        videoId: uuid,
        tasks: [
          {
            name: 'cut' as 'cut',
            options: { start: 1 }
          }
        ]
      })

      await waitJobs(servers)
      await checkAutoCaption({ servers, uuid })

      const newContent = await getCaptionContent(servers[0], uuid, 'en')
      expect(oldContent).to.not.equal(newContent)
    })

    it('Should not run transcription after video edition if the subtitle has not been auto generated', async function () {
      this.timeout(120000)

      const uuid = await uploadForTranscription(servers[0], { language: 'en' })
      await waitJobs(servers)

      await servers[0].captions.add({ language: 'en', videoId: uuid, fixture: 'subtitle-good1.vtt' })
      const oldContent = await getCaptionContent(servers[0], uuid, 'en')

      await servers[0].videoStudio.createEditionTasks({
        videoId: uuid,
        tasks: [
          {
            name: 'cut' as 'cut',
            options: { start: 1 }
          }
        ]
      })

      await waitJobs(servers)

      const newContent = await getCaptionContent(servers[0], uuid, 'en')
      expect(oldContent).to.equal(newContent)
    })

    it('Should run transcription with HLS only and audio splitted', async function () {
      this.timeout(360000)

      await servers[0].config.enableMinimumTranscoding({ hls: true, webVideo: false, splitAudioAndVideo: true })

      const uuid = await uploadForTranscription(servers[0], { generateTranscription: false })
      await waitJobs(servers)
      await checkLanguage(servers, uuid, null)

      await servers[0].captions.runGenerate({ videoId: uuid })
      await waitJobs(servers)

      await checkAutoCaption({ servers, uuid })
      await checkLanguage(servers, uuid, 'en')
    })
  })

  describe('On object storage', async function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    before(async function () {
      this.timeout(120000)

      const configOverride = objectStorage.getDefaultMockConfig()
      await objectStorage.prepareDefaultMockBuckets()

      await servers[0].kill()
      await servers[0].run(configOverride)
    })

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

      await checkAutoCaption({ servers, uuid, objectStorageBaseUrl: objectStorage.getMockCaptionFileBaseUrl() })
    })

    it('Should run transcription on upload by default', async function () {
      this.timeout(360000)

      const uuid = await uploadForTranscription(servers[0])

      await waitJobs(servers)
      await checkAutoCaption({ servers, uuid, objectStorageBaseUrl: objectStorage.getMockCaptionFileBaseUrl() })
      await checkLanguage(servers, uuid, 'en')
    })

    after(async function () {
      await objectStorage.cleanupMock()
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
