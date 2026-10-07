/* oxlint-disable @typescript-eslint/no-unused-expressions */

import {
  canDoQuickVideoTranscode,
  FFmpegVOD,
  getDefaultAvailableEncoders,
  getDefaultEncodersToTry,
  getVideoStreamStereo3D
} from '@peertube/peertube-ffmpeg'
import { expect } from 'chai'
import { Mutex } from 'async-mutex'
import { execFile } from 'child_process'
import { remove } from 'fs-extra/esm'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

const execFilePromise = promisify(execFile)

// The input is 64x64 views side by side or on top of each other: a red one and a blue one. In Matroska's StereoMode of the
// input the first one is the left eye (`left_right`, `top_bottom`) or the right eye (`right_left`, `bottom_top`)
describe('Transcoding of 3D videos', function () {
  let tmpDirectory: string

  before(async function () {
    tmpDirectory = await mkdtemp(join(tmpdir(), 'peertube-test-stereo3d-'))
  })

  async function generate (stereoMode: string, stack: 'hstack' | 'vstack') {
    const output = join(tmpDirectory, `${stereoMode}.mkv`)

    await execFilePromise('ffmpeg', [
      '-v', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=25:d=2',
      '-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=25:d=2',
      '-filter_complex', `[0:v][1:v]${stack}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-metadata:s:v:0', `stereo_mode=${stereoMode}`,
      output
    ])

    return output
  }

  async function transcode (input: string) {
    const output = input.replace(/\.mkv$/, '-transcoded.mp4')
    const noop = () => {}

    const ffmpeg = new FFmpegVOD({
      availableEncoders: { available: getDefaultAvailableEncoders(), encodersToTry: getDefaultEncodersToTry() },
      profile: 'default',
      niceness: 0,
      threads: 1,
      tmpDirectory,
      logger: { info: noop, debug: noop, warn: noop, error: noop }
    })

    await ffmpeg.transcode({
      type: 'video',
      videoInputPath: input,
      outputPath: output,
      inputFileMutexReleaser: await new Mutex().acquire(),
      resolution: 64,
      fps: 25
    })

    return output
  }

  // The color of the first and of the second view of the first frame, as the two red/blue components of the center of each
  async function getViews (path: string, stack: 'hstack' | 'vstack') {
    const crops = stack === 'hstack'
      ? [ 'crop=iw/2:ih:0:0', 'crop=iw/2:ih:iw/2:0' ]
      : [ 'crop=iw:ih/2:0:0', 'crop=iw:ih/2:0:ih/2' ]

    const views: string[] = []

    for (const crop of crops) {
      const { stdout } = await execFilePromise('ffmpeg', [
        '-v', 'error', '-i', path, '-frames:v', '1', '-vf', `${crop},scale=1:1`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'
      ], { encoding: 'buffer' }) as unknown as { stdout: Buffer }

      views.push(stdout[0] > stdout[2] ? 'red' : 'blue')
    }

    return views
  }

  async function hasFramePacking (path: string) {
    const { stdout } = await execFilePromise('ffprobe', [
      '-v', 'error', '-select_streams', 'v:0', '-show_frames', '-read_intervals', '%+#1', '-of', 'json', path
    ])

    const frame = JSON.parse(stdout).frames[0]

    return (frame.side_data_list || []).some((d: { side_data_type: string }) => d.side_data_type === 'Stereo 3D')
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

        input = await generate(stereoMode, stack)
      })

      it('Should get the 3D packing of the input', async function () {
        expect(await getVideoStreamStereo3D(input)).to.deep.equal({ type, inverted })
      })

      it('Should not copy the video of the input', async function () {
        expect(await canDoQuickVideoTranscode(input, 60)).to.be.false
      })

      it('Should keep the 3D packing in the transcoded video, the left eye first', async function () {
        this.timeout(60000)

        const output = await transcode(input)

        expect(await hasFramePacking(output)).to.be.true

        // The input has the red view first: the left eye, unless the right eye comes first
        expect(await getViews(output, stack)).to.deep.equal(inverted ? [ 'blue', 'red' ] : [ 'red', 'blue' ])
      })
    })
  }

  it('Should not report a 3D packing for a 2D video', async function () {
    this.timeout(30000)

    const output = join(tmpDirectory, '2d.mkv')

    await execFilePromise('ffmpeg', [
      '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:r=25:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', output
    ])

    expect(await getVideoStreamStereo3D(output)).to.be.undefined
  })

  after(async function () {
    await remove(tmpDirectory)
  })
})
