import { VideoResolution, VideoResolutionType } from '@peertube/peertube-models'

type BitPerPixel = { [ id in VideoResolutionType ]: number }

// https://bitmovin.com/video-bitrate-streaming-hls-dash/

const minLimitBitPerPixel: BitPerPixel = {
  [VideoResolution.H_NOVIDEO]: 0,
  [VideoResolution.H_144P]: 0.02,
  [VideoResolution.H_240P]: 0.02,
  [VideoResolution.H_360P]: 0.02,
  [VideoResolution.H_480P]: 0.02,
  [VideoResolution.H_720P]: 0.02,
  [VideoResolution.H_1080P]: 0.02,
  [VideoResolution.H_1440P]: 0.02,
  [VideoResolution.H_4K]: 0.02
}

const averageBitPerPixel: BitPerPixel = {
  [VideoResolution.H_NOVIDEO]: 0,
  [VideoResolution.H_144P]: 0.19,
  [VideoResolution.H_240P]: 0.17,
  [VideoResolution.H_360P]: 0.15,
  [VideoResolution.H_480P]: 0.12,
  [VideoResolution.H_720P]: 0.11,
  [VideoResolution.H_1080P]: 0.10,
  [VideoResolution.H_1440P]: 0.09,
  [VideoResolution.H_4K]: 0.08
}

const maxBitPerPixel: BitPerPixel = {
  [VideoResolution.H_NOVIDEO]: 0,
  [VideoResolution.H_144P]: 0.32,
  [VideoResolution.H_240P]: 0.29,
  [VideoResolution.H_360P]: 0.26,
  [VideoResolution.H_480P]: 0.22,
  [VideoResolution.H_720P]: 0.19,
  [VideoResolution.H_1080P]: 0.17,
  [VideoResolution.H_1440P]: 0.16,
  [VideoResolution.H_4K]: 0.14
}

function getAverageTheoreticalBitrate (options: {
  resolution: number
  ratio: number
  fps: number
}) {
  const targetBitrate = calculateBitrate({ ...options, bitPerPixel: averageBitPerPixel })
  if (!targetBitrate) return 192 * 1000

  return targetBitrate
}

function getMaxTheoreticalBitrate (options: {
  resolution: number
  ratio: number
  fps: number
}) {
  const targetBitrate = calculateBitrate({ ...options, bitPerPixel: maxBitPerPixel })
  if (!targetBitrate) return 256 * 1000

  return targetBitrate
}

function getMinTheoreticalBitrate (options: {
  resolution: number
  ratio: number
  fps: number
}) {
  const minLimitBitrate = calculateBitrate({ ...options, bitPerPixel: minLimitBitPerPixel })
  if (!minLimitBitrate) return 10 * 1000

  return minLimitBitrate
}

// ---------------------------------------------------------------------------

export {
  getAverageTheoreticalBitrate,
  getMaxTheoreticalBitrate,
  getMinTheoreticalBitrate
}

// ---------------------------------------------------------------------------

function calculateBitrate (options: {
  bitPerPixel: BitPerPixel
  resolution: number
  ratio: number
  fps: number
}) {
  const { bitPerPixel, resolution, ratio, fps } = options

  const resolutionsOrder = [
    VideoResolution.H_4K,
    VideoResolution.H_1440P,
    VideoResolution.H_1080P,
    VideoResolution.H_720P,
    VideoResolution.H_480P,
    VideoResolution.H_360P,
    VideoResolution.H_240P,
    VideoResolution.H_144P,
    VideoResolution.H_NOVIDEO
  ]

  const size1 = resolution
  const size2 = ratio < 1 && ratio > 0
    ? resolution / ratio // Portrait mode
    : resolution * ratio

  for (const toTestResolution of resolutionsOrder) {
    if (toTestResolution <= resolution) {
      return Math.floor(size1 * size2 * fps * bitPerPixel[toTestResolution])
    }
  }

  throw new Error('Unknown resolution ' + resolution)
}
