export enum VideoResolution {
  H_240P = 240,
  H_360P = 360,
  H_480P = 480,
  H_720P = 720,
  H_1080P = 1080
}

export function getTargetBitrate (resolution: VideoResolution) {
  switch (resolution) {
  case VideoResolution.H_240P:
    // quality according to Google Live Encoder: 400 - 1,000 Kbps
    // Quality according to YouTube Video Info: 263 Kbps
    return 250 * 1000
  case VideoResolution.H_360P:
    // quality according to Google Live Encoder: 400 - 1,000 Kbps
    // Quality according to YouTube Video Info: 531 Kbps
    return 500 * 1000
  case VideoResolution.H_480P:
    // quality according to Google Live Encoder: 500 - 2,000 Kbps
    // Quality according to YouTube Video Info: 847 Kbps
    return 800 * 1000
  case VideoResolution.H_720P:
    // quality according to Google Live Encoder: 1,500 - 4,000 Kbps
    // Quality according to YouTube Video Info: 1525 Kbps
    return 1500 * 1000
  case VideoResolution.H_1080P:
    // quality according to Google Live Encoder: 3000 - 6000 Kbps
    // Quality according to YouTube Video Info: 2788 Kbps
    return 3000 * 1000
  }
}

export function getMaxBitrate (resolution: VideoResolution) {
  return getTargetBitrate(resolution) * 1.2
}
