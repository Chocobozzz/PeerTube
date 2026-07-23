import { expect } from 'chai'
import { ensureDir, pathExists } from 'fs-extra/esm'
import { dirname } from 'path'
import { getMaxTheoreticalBitrate } from '@peertube/peertube-core-utils'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { getVideoStreamBitrate, getVideoStreamDimensionsInfo, getVideoStreamFPS } from '@peertube/peertube-ffmpeg'

async function ensureHasTooBigBitrate (fixturePath: string) {
  const bitrate = await getVideoStreamBitrate(fixturePath)
  const dataResolution = await getVideoStreamDimensionsInfo(fixturePath)
  const fps = await getVideoStreamFPS(fixturePath)

  const maxBitrate = getMaxTheoreticalBitrate({ ...dataResolution, fps })
  expect(bitrate).to.be.above(maxBitrate)
}

async function generateHighBitrateVideo () {
  const tempFixturePath = buildAbsoluteFixturePath('video_high_bitrate_1080p.mp4', true)

  await ensureDir(dirname(tempFixturePath))

  const exists = await pathExists(tempFixturePath)

  if (!exists) {
    const ffmpeg = (await import('fluent-ffmpeg')).default

    console.log('Generating high bitrate video.')

    // Generate a random, high bitrate video on the fly, so we don't have to include
    // a large file in the repo. The video needs to have a certain minimum length so
    // that FFmpeg properly applies bitrate limits.
    // https://stackoverflow.com/a/15795112
    return new Promise<string>((res, rej) => {
      ffmpeg()
        .outputOptions([ '-f rawvideo', '-video_size 1920x1080', '-i /dev/urandom' ])
        .outputOptions([ '-ac 2', '-f s16le', '-i /dev/urandom', '-t 10' ])
        .outputOptions([ '-maxrate 10M', '-bufsize 10M' ])
        .output(tempFixturePath)
        .on('error', rej)
        .on('end', () => res(tempFixturePath))
        .run()
    })
  }

  await ensureHasTooBigBitrate(tempFixturePath)

  return tempFixturePath
}

async function generateVideoWithFramerate (fps = 120, size = '1280x720') {
  const tempFixturePath = buildAbsoluteFixturePath(`video_${fps}fps.mp4`, true)

  await ensureDir(dirname(tempFixturePath))

  const exists = await pathExists(tempFixturePath)
  if (!exists) {
    const ffmpeg = (await import('fluent-ffmpeg')).default

    console.log('Generating video with framerate %d.', fps)

    return new Promise<string>((res, rej) => {
      ffmpeg()
        .outputOptions([ '-f rawvideo', '-video_size ' + size, '-i /dev/urandom' ])
        .outputOptions([ '-ac 2', '-f s16le', '-i /dev/urandom', '-t 5' ])
        .outputOptions([ `-vf fps=${fps}` ])
        .output(tempFixturePath)
        .on('error', rej)
        .on('end', () => res(tempFixturePath))
        .run()
    })
  }

  return tempFixturePath
}

type CodecFixtureOptions = {
  videoCodec: 'libaom-av1' | 'libvpx-vp9' | 'libx264' | 'mpeg2video'
  audioCodec: 'aac' | 'libopus' | 'libvorbis'
  pixelFormat?: 'yuv420p' | 'yuv420p10le'
  container: 'mp4' | 'mkv'
}

async function generateVideoWithCodec (name: string, options: CodecFixtureOptions) {
  const tempFixturePath = buildAbsoluteFixturePath(name, true)

  await ensureDir(dirname(tempFixturePath))

  if (await pathExists(tempFixturePath)) return tempFixturePath

  const ffmpeg = (await import('fluent-ffmpeg')).default

  console.log('Generating fixture %s.', name)

  return new Promise<string>((res, rej) => {
    const cmd = ffmpeg()
      .input('testsrc=size=320x240:rate=25:duration=2')
      .inputFormat('lavfi')
      .input('sine=frequency=440:duration=2')
      .inputFormat('lavfi')
      .videoCodec(options.videoCodec)
      .audioCodec(options.audioCodec)
      .outputOptions([ '-pix_fmt', options.pixelFormat ?? 'yuv420p' ])
      .outputOptions([ '-b:v', '200k' ])
      .outputOptions([ '-b:a', '96k' ])
      .outputOptions([ '-shortest' ])

    if (options.videoCodec === 'libaom-av1') {
      cmd.outputOptions([ '-cpu-used', '8', '-row-mt', '1' ])
    }
    if (options.videoCodec === 'libvpx-vp9') {
      cmd.outputOptions([ '-deadline', 'realtime', '-cpu-used', '8' ])
    }

    cmd
      .format(options.container)
      .output(tempFixturePath)
      .on('error', rej)
      .on('end', () => res(tempFixturePath))
      .run()
  })
}

export {
  generateHighBitrateVideo,
  generateVideoWithFramerate,
  generateVideoWithCodec
}
