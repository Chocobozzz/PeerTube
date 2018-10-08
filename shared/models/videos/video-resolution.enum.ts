import { VideoTranscodingFPS } from './video-transcoding-fps.model'

export enum VideoResolution {
  H_240P = 240,
  H_360P = 360,
  H_480P = 480,
  H_720P = 720,
  H_1080P = 1080
}

/**
 * Bitrate targets for different resolutions and frame rates, in bytes per second.
 * Sources for individual quality levels:
 * Google Live Encoder: https://support.google.com/youtube/answer/2853702?hl=en
 * YouTube Video Info (tested with random music video): https://www.h3xed.com/blogmedia/youtube-info.php
 */
export function getTargetBitrate (resolution: VideoResolution, fps: number,
    fpsTranscodingConstants: VideoTranscodingFPS) {
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
    if (fps === fpsTranscodingConstants.MAX) {
      // quality according to Google Live Encoder: 2,250 - 6,000 Kbps
      // Quality according to YouTube Video Info: 2634 Kbps
      return 2600 * 1000
    }

    // quality according to Google Live Encoder: 1,500 - 4,000 Kbps
    // Quality according to YouTube Video Info: 1752 Kbps
    return 1750 * 1000
  case VideoResolution.H_1080P: // fallthrough
  default:
    if (fps === fpsTranscodingConstants.MAX) {
      // quality according to Google Live Encoder: 3000 - 6000 Kbps
      // Quality according to YouTube Video Info: 4387 Kbps
      return 4400 * 1000
    }

    // quality according to Google Live Encoder: 3000 - 6000 Kbps
    // Quality according to YouTube Video Info: 3277 Kbps
    return 3300 * 1000
  }
}

/**
 * The maximum bitrate we expect to see on a transcoded video in bytes per second.
 */
export function getMaxBitrate (resolution: VideoResolution, fps: number,
    fpsTranscodingConstants: VideoTranscodingFPS) {
  return getTargetBitrate(resolution, fps, fpsTranscodingConstants) * 2
}
