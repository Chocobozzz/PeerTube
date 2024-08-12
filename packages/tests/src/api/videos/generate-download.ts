/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getHLS } from '@peertube/peertube-core-utils'
import { VideoDetails, VideoFile, VideoResolution } from '@peertube/peertube-models'
import { buildSUUID } from '@peertube/peertube-node-utils'
import {
  ObjectStorageCommand,
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  followAll,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { checkTmpIsEmpty } from '@tests/shared/directories.js'
import { probeResBody } from '@tests/shared/videos.js'
import { expect } from 'chai'
import { FfprobeData } from 'fluent-ffmpeg'

describe('Test generate download', function () {
  let servers: PeerTubeServer[]

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await followAll(servers)
  })

  function runSuite (serverGetter: () => PeerTubeServer, objectStorage?: ObjectStorageCommand) {
    const seed = buildSUUID()

    let server: PeerTubeServer

    before(async function () {
      this.timeout(120000)

      server = serverGetter()

      if (objectStorage) {
        await objectStorage.prepareDefaultMockBuckets()

        await server.kill()
        await server.run(objectStorage.getDefaultMockConfig())
      }

      const resolutions = [ VideoResolution.H_NOVIDEO, VideoResolution.H_144P ]

      {
        await server.config.enableTranscoding({ hls: true, webVideo: true, splitAudioAndVideo: false, resolutions })
        await server.videos.quickUpload({ name: 'common-' + seed })
        await waitJobs(servers)
      }

      {
        await server.config.enableTranscoding({ webVideo: false, hls: true, splitAudioAndVideo: true, resolutions })
        await server.videos.quickUpload({ name: 'splitted-' + seed })
        await waitJobs(servers)
      }
    })

    function getVideoFile (files: VideoFile[]) {
      return files.find(f => f.hasVideo === true)
    }

    function getAudioFile (files: VideoFile[]) {
      return files.find(f => f.hasAudio === true)
    }

    function getAudioOnlyFile (files: VideoFile[]) {
      return files.find(f => f.hasAudio === true && f.hasVideo === false)
    }

    async function getProbe (name: 'common' | 'splitted', filesGetter: (video: VideoDetails) => number[]) {
      const video = await servers[0].videos.findFull({ name: name + '-' + seed })

      const body = await servers[0].videos.generateDownload({ videoId: video.id, videoFileIds: filesGetter(video) })

      return probeResBody(body)
    }

    function checkProbe (probe: FfprobeData, options: { hasVideo: boolean, hasAudio: boolean, hasImage: boolean }) {
      expect(probe.streams.some(s => s.codec_type === 'video' && s.codec_name !== 'mjpeg')).to.equal(options.hasVideo)
      expect(probe.streams.some(s => s.codec_type === 'audio')).to.equal(options.hasAudio)
      expect(probe.streams.some(s => s.codec_name === 'mjpeg')).to.equal(options.hasImage)
    }

    it('Should generate a classic web video file', async function () {
      const probe = await getProbe('common', video => [ getVideoFile(video.files).id ])

      checkProbe(probe, { hasAudio: true, hasVideo: true, hasImage: false })
    })

    it('Should generate a classic HLS file', async function () {
      const probe = await getProbe('common', video => [ getVideoFile(getHLS(video).files).id ])

      checkProbe(probe, { hasAudio: true, hasVideo: true, hasImage: false })
    })

    it('Should generate an audio only web video file', async function () {
      const probe = await getProbe('common', video => [ getAudioOnlyFile(video.files).id ])

      checkProbe(probe, { hasAudio: true, hasVideo: false, hasImage: true })
    })

    it('Should generate an audio only HLS file', async function () {
      const probe = await getProbe('common', video => [ getAudioOnlyFile(getHLS(video).files).id ])

      checkProbe(probe, { hasAudio: true, hasVideo: false, hasImage: true })
    })

    it('Should generate a video only file', async function () {
      const probe = await getProbe('splitted', video => [ getVideoFile(getHLS(video).files).id ])

      checkProbe(probe, { hasAudio: false, hasVideo: true, hasImage: false })
    })

    it('Should merge audio and video files', async function () {
      const probe = await getProbe('splitted', video => [ getVideoFile(getHLS(video).files).id, getAudioFile(getHLS(video).files).id ])

      checkProbe(probe, { hasAudio: true, hasVideo: true, hasImage: false })
    })

    it('Should have cleaned the TMP directory', async function () {
      for (const server of servers) {
        await checkTmpIsEmpty(server)
      }
    })
  }

  for (const objectStorage of [ undefined, new ObjectStorageCommand() ]) {
    const testName = objectStorage
      ? 'On Object Storage'
      : 'On filesystem'

    describe(testName, function () {

      describe('Videos on local server', function () {
        runSuite(() => servers[0], objectStorage)
      })

      describe('Videos on remote server', function () {
        runSuite(() => servers[1], objectStorage)
      })
    })
  }

  after(async function () {
    await cleanupTests(servers)
  })
})
