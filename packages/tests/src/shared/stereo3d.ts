import { VideoStereo3D } from '@peertube/peertube-models'
import { execFile } from 'child_process'
import { join } from 'path'
import { promisify } from 'util'

const execFilePromise = promisify(execFile)

export type Stereo3DStack = 'hstack' | 'vstack'

// Generate views side by side or on top of each other: a red one and a blue one
export async function generateStereo3DVideo (options: {
  directory: string
  stereoMode: string
  stack: Stereo3DStack
  rotation?: number
  name?: string
  viewSize?: number // default 64
}) {
  const { directory, stereoMode, stack, rotation, name = stereoMode, viewSize = 64 } = options

  const output = join(directory, `${name}.mkv`)

  await execFilePromise('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=red:s=${viewSize}x${viewSize}:r=25:d=2`,
    '-f',
    'lavfi',
    '-i',
    `color=c=blue:s=${viewSize}x${viewSize}:r=25:d=2`,
    '-filter_complex',
    `[0:v][1:v]${stack}`,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-metadata:s:v:0',
    `stereo_mode=${stereoMode}`,
    output
  ])

  if (rotation === undefined) return output

  const rotated = join(directory, `${name}-rotated.mkv`)

  await execFilePromise('ffmpeg', [ '-v', 'error', '-y', '-display_rotation', rotation + '', '-i', output, '-c', 'copy', rotated ])

  return rotated
}

// The color of the first and of the second view of the first frame, as the two red/blue components of the center of each
export async function getStereo3DViews (path: string, stack: Stereo3DStack) {
  const crops = stack === 'hstack'
    ? [ 'crop=iw/2:ih:0:0', 'crop=iw/2:ih:iw/2:0' ]
    : [ 'crop=iw:ih/2:0:0', 'crop=iw:ih/2:0:ih/2' ]

  const views: string[] = []

  for (const crop of crops) {
    const [ r, , b ] = await getFirstFrameColor(path, crop)

    views.push(r > b ? 'red' : 'blue')
  }

  return views
}

// The RGB components of the average color of the cropped first frame
export async function getFirstFrameColor (path: string, crop: string) {
  const { stdout } = await execFilePromise('ffmpeg', [
    '-v',
    'error',
    '-i',
    path,
    '-frames:v',
    '1',
    '-vf',
    `${crop},scale=1:1`,
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgb24',
    '-'
  ], { encoding: 'buffer' }) as unknown as { stdout: Buffer }

  return [ stdout[0], stdout[1], stdout[2] ]
}

export async function getFramePacking (path: string): Promise<VideoStereo3D> {
  const { stderr } = await execFilePromise('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i',
    path,
    '-frames:v',
    '1',
    '-vf',
    'showinfo',
    '-f',
    'null',
    '-'
  ])

  // FFmpeg 4.3 prints "stereoscopic information", newer versions "Stereo 3D"
  const matches = stderr.match(/side data - (?:Stereo 3D|stereoscopic information): type - ([^,(]+?)( \(inverted\))?(,|$)/m)
  if (!matches) return undefined

  return { type: matches[1], inverted: !!matches[2] }
}
