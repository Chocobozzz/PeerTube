/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { FFmpegContainer, ffprobePromise } from '@peertube/peertube-ffmpeg'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
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
    async function mergeAndProbe (coverPath: string) {
      const outputPath = join(tmpDirectory, 'output.mp4')

      await buildFFmpegContainer().mergeInputs({
        inputs: [ buildAbsoluteFixturePath('video_short_0p.mp4') ],
        output: createWriteStream(outputPath),
        logError: true,
        coverPath
      })

      return ffprobePromise(outputPath)
    }

    async function checkAudioWithJPEGCover (coverPath: string) {
      const probe = await mergeAndProbe(coverPath)

      const audioStreams = probe.streams.filter(s => s.codec_type === 'audio')
      expect(audioStreams).to.have.lengthOf(1)
      expect(audioStreams[0].codec_name).to.equal('aac')

      const videoStreams = probe.streams.filter(s => s.codec_type === 'video')
      expect(videoStreams).to.have.lengthOf(1)
      expect(videoStreams[0].codec_name).to.equal('mjpeg')
    }

    for (const coverFixture of [ 'custom-thumbnail-big.jpg', 'avatar.png', 'avatar.webp' ]) {
      it(`Should embed ${coverFixture} cover as JPEG`, async function () {
        this.timeout(30000)

        await checkAudioWithJPEGCover(buildAbsoluteFixturePath(coverFixture))
      })
    }

    it('Should embed a webp cover with a misleading extension as JPEG', async function () {
      this.timeout(30000)

      // Remote thumbnails are downloaded as is, with an extension built from the mimetype sent by the remote server
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
})
