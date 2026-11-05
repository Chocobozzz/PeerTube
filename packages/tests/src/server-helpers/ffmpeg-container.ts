/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { FFmpegContainer, ffprobePromise } from '@peertube/peertube-ffmpeg'
import { buildAbsoluteFixturePath, execPromise } from '@peertube/peertube-node-utils'
import { expect } from 'chai'
import { createWriteStream } from 'fs'
import { copy, remove } from 'fs-extra/esm'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

describe('FFmpeg container', function () {
  let tmpDirectory: string

  before(async function () {
    tmpDirectory = await mkdtemp(join(tmpdir(), 'peertube-test-ffmpeg-container-'))
  })

  describe('Merge an audio file with a cover', function () {
    const audioPath = buildAbsoluteFixturePath('video_short_0p.mp4')

    async function mergeAndProbe (coverPath: string) {
      const outputPath = join(tmpDirectory, 'output.mp4')

      await buildFFmpegContainer().mergeInputs({
        inputs: [ audioPath ],
        output: createWriteStream(outputPath),
        logError: true,
        coverPath
      })

      return { probe: await ffprobePromise(outputPath), outputPath }
    }

    async function checkAudioWithJPEGCover (coverPath: string) {
      const { probe, outputPath } = await mergeAndProbe(coverPath)

      const audioStreams = probe.streams.filter(s => s.codec_type === 'audio')
      expect(audioStreams).to.have.lengthOf(1)
      expect(audioStreams[0].codec_name).to.equal('aac')

      const videoStreams = probe.streams.filter(s => s.codec_type === 'video')
      expect(videoStreams).to.have.lengthOf(1)
      expect(videoStreams[0].codec_name).to.equal('mjpeg')

      // The cover is a single image and the audio stream is entirely copied
      const outputPackets = await countPackets(outputPath)
      expect(outputPackets.video).to.equal(1)
      expect(outputPackets.audio).to.equal((await countPackets(audioPath)).audio)
    }

    for (const coverFixture of [ 'custom-thumbnail-big.jpg', 'avatar.png', 'avatar.webp', 'avatar.gif' ]) {
      it(`Should embed ${coverFixture} cover as JPEG`, async function () {
        this.timeout(30000)

        await checkAudioWithJPEGCover(buildAbsoluteFixturePath(coverFixture))
      })
    }

    it('Should embed a webp cover with a misleading extension as JPEG', async function () {
      this.timeout(30000)

      // Remote thumbnails are downloaded as is, with an extension built from the remote file URL
      const coverPath = join(tmpDirectory, 'webp-cover.jpg')
      await copy(buildAbsoluteFixturePath('avatar.webp'), coverPath)

      await checkAudioWithJPEGCover(coverPath)
    })
  })

  after(async function () {
    await remove(tmpDirectory)
  })

  function buildFFmpegContainer () {
    const noop = () => {}

    return new FFmpegContainer({
      niceness: 0,
      threads: 1,
      tmpDirectory,
      logger: { info: noop, debug: noop, warn: noop, error: noop }
    })
  }

  async function countPackets (path: string) {
    const result = JSON.parse(
      await execPromise(`ffprobe -v error -count_packets -show_entries stream=codec_type,nb_read_packets -of json ${path}`)
    )

    const streams: { codec_type: string, nb_read_packets: string }[] = result.streams
    const getCount = (type: string) => parseInt(streams.find(s => s.codec_type === type)?.nb_read_packets)

    return { audio: getCount('audio'), video: getCount('video') }
  }
})
