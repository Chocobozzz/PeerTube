/* oxlint-disable @typescript-eslint/no-unused-expressions */

import {
  canDoQuickVideoTranscode,
  FFmpegCommandWrapperOptions,
  FFmpegEdition,
  FFmpegVOD,
  getDefaultAvailableEncoders,
  getDefaultEncodersToTry,
  getVideoStreamDimensionsInfo,
  getVideoStreamStereo3D
} from '@peertube/peertube-ffmpeg'
import { generateStereo3DVideo, getFirstFrameColor, getFramePacking, getStereo3DViews } from '@tests/shared/stereo3d.js'
import { expect } from 'chai'
import { Mutex } from 'async-mutex'
import { execFile } from 'child_process'
import { remove } from 'fs-extra/esm'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

const execFilePromise = promisify(execFile)

describe('Transcoding of 3D videos', function () {
  let tmpDirectory: string

  before(async function () {
    tmpDirectory = await mkdtemp(join(tmpdir(), 'peertube-test-stereo3d-'))
  })

  function getFFmpegOptions (): FFmpegCommandWrapperOptions {
    const noop = () => {}

    return {
      availableEncoders: { available: getDefaultAvailableEncoders(), encodersToTry: getDefaultEncodersToTry() },
      profile: 'default',
      niceness: 0,
      threads: 1,
      tmpDirectory,
      logger: { info: noop, debug: noop, warn: noop, error: noop }
    }
  }

  async function transcode (input: string) {
    const output = input.replace(/\.mkv$/, '-transcoded.mp4')

    await new FFmpegVOD(getFFmpegOptions()).transcode({
      type: 'video',
      videoInputPath: input,
      outputPath: output,
      inputFileMutexReleaser: await new Mutex().acquire(),
      resolution: 64,
      fps: 25
    })

    return output
  }

  const modes = [
    { stereoMode: 'left_right', stack: 'hstack' as const, type: 'side by side', inverted: false },
    { stereoMode: 'right_left', stack: 'hstack' as const, type: 'side by side', inverted: true },
    { stereoMode: 'top_bottom', stack: 'vstack' as const, type: 'top and bottom', inverted: false },
    { stereoMode: 'bottom_top', stack: 'vstack' as const, type: 'top and bottom', inverted: true }
  ]

  for (const { stereoMode, stack, type, inverted } of modes) {
    describe('With the StereoMode ' + stereoMode, function () {
      let input: string

      before(async function () {
        this.timeout(30000)

        input = await generateStereo3DVideo({ directory: tmpDirectory, stereoMode, stack })
      })

      it('Should get the 3D packing of the input', async function () {
        expect(await getVideoStreamStereo3D(input)).to.deep.equal({ type, inverted })
      })

      it('Should not copy the video of the input', async function () {
        expect(await canDoQuickVideoTranscode(input, 60)).to.be.false
      })

      it('Should copy the video of the input if the encoder does not keep the 3D packing', async function () {
        expect(await canDoQuickVideoTranscode(input, 60, undefined, { reEncodeKeepsStereo3D: false })).to.be.true
      })

      it('Should keep the 3D packing in the transcoded video, the left eye first', async function () {
        this.timeout(60000)

        const output = await transcode(input)

        expect(await getFramePacking(output)).to.deep.equal({ type, inverted: false })

        // The input has the red view first: the left eye, unless the right eye comes first
        expect(await getStereo3DViews(output, stack)).to.deep.equal(inverted ? [ 'blue', 'red' ] : [ 'red', 'blue' ])
      })
    })
  }

  const matrix = [
    {
      input: { stereoMode: 'left_right', stack: 'hstack' as const, rotation: 90 },
      output: { type: 'top and bottom', inverted: true, stack: 'vstack' as const }
    },
    {
      input: { stereoMode: 'left_right', stack: 'hstack' as const, rotation: -90 },
      output: { type: 'top and bottom', inverted: false, stack: 'vstack' as const }
    },
    {
      input: { stereoMode: 'left_right', stack: 'hstack' as const, rotation: 180 },
      output: { type: 'side by side', inverted: true, stack: 'hstack' as const }
    },
    {
      input: { stereoMode: 'top_bottom', stack: 'vstack' as const, rotation: 90 },
      output: { type: 'side by side', inverted: false, stack: 'hstack' as const }
    },
    {
      input: { stereoMode: 'top_bottom', stack: 'vstack' as const, rotation: -90 },
      output: { type: 'side by side', inverted: true, stack: 'hstack' as const }
    }
  ]

  for (const toTest of matrix) {
    describe(`With the StereoMode ${toTest.input.stereoMode} and a rotation of ${toTest.input.rotation}°`, function () {
      let input: string

      before(async function () {
        this.timeout(30000)

        const { stereoMode, stack, rotation } = toTest.input

        try {
          input = await generateStereo3DVideo({ directory: tmpDirectory, stereoMode, stack, rotation, name: `${stereoMode}-${rotation}` })
        } catch (err) {
          // Old ffmpeg versions do not have the -display_rotation option
          if (/Unrecognized option 'display_rotation'/.test(err.stderr || err.message)) return this.skip()

          throw err
        }

        // Old ffmpeg versions do not read the rotation of Matroska files
        if (!(await getVideoStreamDimensionsInfo(input)).hasRotation) this.skip()
      })

      it('Should get the 3D packing of the rotated frames', async function () {
        const { type, inverted } = toTest.output

        expect(await getVideoStreamStereo3D(input)).to.deep.equal({ type, inverted })
      })

      it('Should keep the 3D packing of the rotated frames, the left eye first', async function () {
        this.timeout(60000)

        const { type, stack } = toTest.output

        const output = await transcode(input)

        expect(await getFramePacking(output)).to.deep.equal({ type, inverted: false })
        expect(await getStereo3DViews(output, stack)).to.deep.equal([ 'red', 'blue' ])
      })
    })
  }

  describe('With a 3D packing that libx264 cannot keep', function () {
    let input: string

    before(async function () {
      this.timeout(30000)

      input = await generateStereo3DVideo({ directory: tmpDirectory, stereoMode: 'checkerboard_lr', stack: 'hstack' })
    })

    it('Should get the 3D packing of the input', async function () {
      expect(await getVideoStreamStereo3D(input)).to.deep.equal({ type: 'checkerboard', inverted: false })
    })

    it('Should copy the video of the input', async function () {
      expect(await canDoQuickVideoTranscode(input, 60)).to.be.true
    })

    it('Should not write a 3D packing in the transcoded video', async function () {
      this.timeout(60000)

      const output = await transcode(input)

      expect(await getFramePacking(output)).to.be.undefined
    })
  })

  describe('With studio edition', function () {
    let input: string

    before(async function () {
      this.timeout(30000)

      input = await generateStereo3DVideo({ directory: tmpDirectory, stereoMode: 'right_left', stack: 'hstack', name: 'studio' })
    })

    it('Should not swap the views of a 2D intro', async function () {
      this.timeout(60000)

      // A red and blue intro, that a swap of the views would turn into a blue and red one
      const intro = join(tmpDirectory, 'intro.mp4')

      await execFilePromise('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=red:s=64x64:r=25:d=1',
        '-f',
        'lavfi',
        '-i',
        'color=c=blue:s=64x64:r=25:d=1',
        '-filter_complex',
        '[0:v][1:v]hstack',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        intro
      ])

      const output = join(tmpDirectory, 'studio-intro.mp4')

      await new FFmpegEdition(getFFmpegOptions()).addIntroOutro({
        videoInputPath: input,
        introOutroPath: intro,
        outputPath: output,
        type: 'intro'
      })

      expect(await getStereo3DViews(output, 'hstack')).to.deep.equal([ 'red', 'blue' ])
    })

    it('Should not move the watermark', async function () {
      this.timeout(60000)

      const watermark = join(tmpDirectory, 'watermark.png')

      await execFilePromise('ffmpeg', [ '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=white:s=16x16', '-frames:v', '1', watermark ])

      const output = join(tmpDirectory, 'studio-watermark.mp4')

      await new FFmpegEdition(getFFmpegOptions()).addWatermark({
        videoInputPath: input,
        watermarkPath: watermark,
        outputPath: output,
        videoFilters: { watermarkSizeRatio: 0.25, horizontalMarginRatio: 0, verticalMarginRatio: 0 }
      })

      expect(await getStereo3DViews(output, 'hstack')).to.deep.equal([ 'red', 'blue' ])

      // The top right corner of the frame
      for (const component of await getFirstFrameColor(output, 'crop=8:8:iw-8:0')) {
        expect(component).to.be.above(200)
      }
    })
  })

  it('Should not report a 3D packing for a 2D video', async function () {
    this.timeout(30000)

    const output = join(tmpDirectory, '2d.mkv')

    await execFilePromise('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=red:s=64x64:r=25:d=1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      output
    ])

    expect(await getVideoStreamStereo3D(output)).to.be.undefined
  })

  after(async function () {
    await remove(tmpDirectory)
  })
})
