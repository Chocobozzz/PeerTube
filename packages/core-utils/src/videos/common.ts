import { VideoDetails, VideoPrivacy, VideoResolution, VideoStreamingPlaylistType } from '@peertube/peertube-models'

export function getAllPrivacies () {
  return [ VideoPrivacy.PUBLIC, VideoPrivacy.INTERNAL, VideoPrivacy.PRIVATE, VideoPrivacy.UNLISTED, VideoPrivacy.PASSWORD_PROTECTED ]
}

export function getAllFiles (video: Partial<Pick<VideoDetails, 'files' | 'streamingPlaylists'>>) {
  const files = video.files

  const hls = getHLS(video)
  if (hls) return files.concat(hls.files)

  return files
}

export function getHLS (video: Partial<Pick<VideoDetails, 'streamingPlaylists'>>) {
  return video.streamingPlaylists.find(p => p.type === VideoStreamingPlaylistType.HLS)
}

export function buildAspectRatio (options: { width: number, height: number }) {
  const { width, height } = options
  if (!width || !height) return null

  return Math.round((width / height) * 10000) / 10000 // 4 decimals precision
}

const classicResolutions = new Set<number>([
  VideoResolution.H_NOVIDEO,
  VideoResolution.H_144P,
  VideoResolution.H_240P,
  VideoResolution.H_360P,
  VideoResolution.H_480P,
  VideoResolution.H_720P,
  VideoResolution.H_1080P,
  VideoResolution.H_1440P,
  VideoResolution.H_4K
])

const resolutionConverter = {
  3840: VideoResolution.H_4K,
  1920: VideoResolution.H_1080P,
  1280: VideoResolution.H_720P,
  854: VideoResolution.H_480P,
  640: VideoResolution.H_360P,
  426: VideoResolution.H_240P,
  256: VideoResolution.H_144P
}

export function getResolutionLabel (options: {
  resolution: number
  height: number
  width: number
}) {
  const { height, width } = options

  if (options.resolution === 0) return 'Audio only'

  let resolution = options.resolution

  // Try to find a better resolution label
  // For example with a video 1920x816 we prefer to display "1080p"
  if (!classicResolutions.has(resolution) && typeof height === 'number' && typeof width === 'number') {
    const max = Math.max(height, width)

    const alternativeLabel = resolutionConverter[max]
    if (alternativeLabel) resolution = resolutionConverter[max]
  }

  return `${resolution}p`
}

export function getResolutionAndFPSLabel (resolutionLabel: string, fps: number) {
  if (fps && fps >= 50) return resolutionLabel + fps

  return resolutionLabel
}
