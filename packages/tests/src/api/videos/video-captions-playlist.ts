/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getHLS } from '@peertube/peertube-core-utils'
import { ffprobePromise } from '@peertube/peertube-ffmpeg'
import { HttpStatusCode, VideoResolution } from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'
import { expect } from 'chai'

describe('Test video caption playlist', function () {
  let servers: PeerTubeServer[]
  let videoUUID: string

  before(async function () {
    this.timeout(60000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    await waitJobs(servers)

    await servers[0].config.enableMinimumTranscoding()
  })

  async function renewVideo () {
    const { uuid } = await servers[0].videos.upload({ attributes: { name: 'video' } })
    videoUUID = uuid
  }

  async function addCaptions () {
    for (const language of [ 'zh', 'fr' ]) {
      await servers[0].captions.add({
        language,
        videoId: videoUUID,
        fixture: 'subtitle-good.srt'
      })
    }
  }

  function runTests (objectStorageBaseUrl?: string) {
    async function checkPlaylist () {
      const { data: captions } = await servers[0].captions.list({ videoId: videoUUID })

      await completeCheckHlsPlaylist({
        servers,
        videoUUID,
        hlsOnly: false,
        hasAudio: true,
        hasVideo: true,
        captions,
        objectStorageBaseUrl,
        resolutions: [ VideoResolution.H_720P, VideoResolution.H_240P ]
      })

      for (const caption of captions) {
        // TODO: remove condition when ffmpeg static is not used anymore.
        // See https://stackoverflow.com/questions/60528501/ffmpeg-segmentation-fault-with-network-stream-source
        if (!objectStorageBaseUrl) {
          const { streams } = await ffprobePromise(caption.m3u8Url)
          expect(streams.find(s => s.codec_name === 'webvtt')).to.exist
        }
      }
    }

    it('Should create a caption playlist on a HLS video', async function () {
      await renewVideo()
      await waitJobs(servers)

      await checkPlaylist()

      await addCaptions()
      await waitJobs(servers)

      await checkPlaylist()
    })

    it('Should delete the video and delete caption playlist file', async function () {
      const { data: captions } = await servers[0].captions.list({ videoId: videoUUID })
      const m3u8Url = captions[0].m3u8Url
      await makeRawRequest({ url: m3u8Url, expectedStatus: HttpStatusCode.OK_200 })

      await servers[0].videos.remove({ id: videoUUID })
      await waitJobs(servers)

      await makeRawRequest({ url: m3u8Url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should create caption playlists on a web video that has been manually transcoded', async function () {
      this.timeout(120000)

      await servers[0].config.enableMinimumTranscoding({ hls: false })

      await renewVideo()
      await waitJobs(servers)

      await addCaptions()
      await waitJobs(servers)

      const { data: captions } = await servers[0].captions.list({ videoId: videoUUID })

      for (const caption of captions) {
        expect(caption.m3u8Url).to.not.exist
      }

      await servers[0].config.enableMinimumTranscoding()
      await servers[0].videos.runTranscoding({ transcodingType: 'hls', videoId: videoUUID })
      await waitJobs(servers)

      await checkPlaylist()
    })

    it('Should delete the caption and delete the caption playlist file', async function () {
      const { data: captions } = await servers[0].captions.list({ videoId: videoUUID })
      const zhCaption = captions.find(c => c.language.id === 'zh')

      await makeRawRequest({ url: zhCaption.m3u8Url, expectedStatus: HttpStatusCode.OK_200 })

      await servers[0].captions.delete({ videoId: videoUUID, language: 'zh' })
      await waitJobs(servers)

      await makeRawRequest({ url: zhCaption.m3u8Url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      const video = await servers[0].videos.get({ id: videoUUID })
      const playlistContent = await servers[0].streamingPlaylists.get({ url: getHLS(video).playlistUrl })
      expect(playlistContent).to.include('LANGUAGE="fr"')
      expect(playlistContent).to.not.include('LANGUAGE="zh"')

      await checkPlaylist()
    })

    it('Should delete all the captions and delete the caption playlist file', async function () {
      const { data: captions } = await servers[0].captions.list({ videoId: videoUUID })
      const frCaption = captions.find(c => c.language.id === 'fr')

      await makeRawRequest({ url: frCaption.m3u8Url, expectedStatus: HttpStatusCode.OK_200 })

      await servers[0].captions.delete({ videoId: videoUUID, language: 'fr' })
      await waitJobs(servers)

      await makeRawRequest({ url: frCaption.m3u8Url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      const video = await servers[0].videos.get({ id: videoUUID })
      const playlistContent = await servers[0].streamingPlaylists.get({ url: getHLS(video).playlistUrl })
      expect(playlistContent).to.not.include('LANGUAGE="zh"')

      await checkPlaylist()
    })

    it('Should remove all HLS files and remove the caption playlist files', async function () {
      await renewVideo()
      await addCaptions()
      await waitJobs(servers)

      const { data: captions } = await servers[0].captions.list({ videoId: videoUUID })
      await checkPlaylist()

      await servers[0].videos.removeHLSPlaylist({ videoId: videoUUID })
      await waitJobs(servers)

      for (const caption of captions) {
        await makeRawRequest({ url: caption.m3u8Url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      }
    })

    it('Should re-add HLS and re-add the caption playlist files', async function () {
      await servers[0].videos.runTranscoding({ transcodingType: 'hls', videoId: videoUUID })
      await waitJobs(servers)

      await checkPlaylist()
    })
  }

  describe('On filesystem', function () {
    runTests()
  })

  describe('On object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    before(async function () {
      this.timeout(60000)

      await objectStorage.prepareDefaultMockBuckets()
      await servers[0].kill()
      await servers[0].run(objectStorage.getDefaultMockConfig())
    })

    runTests(objectStorage.getMockPlaylistBaseUrl())

    after(async function () {
      await objectStorage.cleanupMock()
    })
  })

  describe('With AP federation breaking changes enabled', function () {
    before(async function () {
      await servers[0].kill()
      await servers[0].run()
    })

    it('Should correctly federate captions m3u8 URL', async function () {
      await renewVideo()
      await addCaptions()

      await waitJobs(servers)

      for (const server of servers) {
        const { data: captions } = await server.captions.list({ videoId: videoUUID })

        for (const caption of captions) {
          expect(caption.fileUrl).to.exist
          expect(caption.m3u8Url).to.exist

          await makeRawRequest({ url: caption.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
          await makeRawRequest({ url: caption.m3u8Url, expectedStatus: HttpStatusCode.OK_200 })
        }
      }
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
