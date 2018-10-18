import { VideoTranscodingFPS } from './video-transcoding-fps.model'

export enum VideoResolution {
  H_240P = 240,
  H_360P = 360,
  H_480P = 480,
  H_720P = 720,
  H_1080P = 1080
}

/**
 * Bitrate targets for different resolutions, at VideoTranscodingFPS.AVERAGE.
 *
 * Sources for individual quality levels:
 * Google Live Encoder: https://support.google.com/youtube/answer/2853702?hl=en
 * YouTube Video Info (tested with random music video): https://www.h3xed.com/blogmedia/youtube-info.php
 */
function getBaseBitrate (resolution: VideoResolution) {
  switch (resolution) {
  case VideoResolution.H_240P:
    // quality according to Google Live Encoder: 300 - 700 Kbps
    // Quality according to YouTube Video Info: 186 Kbps
    return 250 * 1000
  case VideoResolution.H_360P:
    // quality according to Google Live Encoder: 400 - 1,000 Kbps
    // Quality according to YouTube Video Info: 480 Kbps
    return 500 * 1000
  case VideoResolution.H_480P:
    // quality according to Google Live Encoder: 500 - 2,000 Kbps
    // Quality according to YouTube Video Info: 879 Kbps
    return 900 * 1000
  case VideoResolution.H_720P:
    // quality according to Google Live Encoder: 1,500 - 4,000 Kbps
    // Quality according to YouTube Video Info: 1752 Kbps
    return 1750 * 1000
  case VideoResolution.H_1080P: // fallthrough
  default:
    // quality according to Google Live Encoder: 3000 - 6000 Kbps
    // Quality according to YouTube Video Info: 3277 Kbps
    return 3300 * 1000
  }
}

/**
 * Calculate the target bitrate based on video resolution and FPS.
 *
 * The calculation is based on two values:
 * Bitrate at VideoTranscodingFPS.AVERAGE is always the same as
 * getBaseBitrate(). Bitrate at VideoTranscodingFPS.MAX is always
 * getBaseBitrate() * 1.4. All other values are calculated linearly
 * between these two points.
 */
export function getTargetBitrate (resolution: VideoResolution, fps: number, fpsTranscodingConstants: VideoTranscodingFPS) {
  const baseBitrate = getBaseBitrate(resolution)
  // The maximum bitrate, used when fps === VideoTranscodingFPS.MAX
  // Based on numbers from Youtube, 60 fps bitrate divided by 30 fps bitrate:
  //  720p: 2600 / 1750 = 1.49
  // 1080p: 4400 / 3300 = 1.33
  const maxBitrate = baseBitrate * 1.4
  const maxBitrateDifference = maxBitrate - baseBitrate
  const maxFpsDifference = fpsTranscodingConstants.MAX - fpsTranscodingConstants.AVERAGE
  // For 1080p video with default settings, this results in the following formula:
  // 3300 + (x - 30) * (1320/30)
  // Example outputs:
  // 1080p10: 2420 kbps, 1080p30: 3300 kbps, 1080p60: 4620 kbps
  //  720p10: 1283 kbps,  720p30: 1750 kbps,  720p60: 2450 kbps
  return baseBitrate + (fps - fpsTranscodingConstants.AVERAGE) * (maxBitrateDifference / maxFpsDifference)
}

/**
 * The maximum bitrate we expect to see on a transcoded video in bytes per second.
 */
export function getMaxBitrate (resolution: VideoResolution, fps: number, fpsTranscodingConstants: VideoTranscodingFPS) {
  return getTargetBitrate(resolution, fps, fpsTranscodingConstants) * 2
}
