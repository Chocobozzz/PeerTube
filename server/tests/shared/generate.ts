import { expect } from 'chai'
import ffmpeg from 'fluent-ffmpeg'
import { ensureDir, pathExists } from 'fs-extra'
import { dirname } from 'path'
import { buildAbsoluteFixturePath, getMaxTheoreticalBitrate } from '@shared/core-utils'
import { getVideoStreamBitrate, getVideoStreamDimensionsInfo, getVideoStreamFPS } from '@shared/ffmpeg'

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

async function generateVideoWithFramerate (fps = 60) {
  const tempFixturePath = buildAbsoluteFixturePath(`video_${fps}fps.mp4`, true)

  await ensureDir(dirname(tempFixturePath))

  const exists = await pathExists(tempFixturePath)
  if (!exists) {
    console.log('Generating video with framerate %d.', fps)

    return new Promise<string>((res, rej) => {
      ffmpeg()
        .outputOptions([ '-f rawvideo', '-video_size 1280x720', '-i /dev/urandom' ])
        .outputOptions([ '-ac 2', '-f s16le', '-i /dev/urandom', '-t 10' ])
        .outputOptions([ `-r ${fps}` ])
        .output(tempFixturePath)
        .on('error', rej)
        .on('end', () => res(tempFixturePath))
        .run()
    })
  }

  return tempFixturePath
}

export {
  generateHighBitrateVideo,
  generateVideoWithFramerate
}
