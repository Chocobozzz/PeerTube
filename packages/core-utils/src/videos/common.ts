import { VideoDetails, VideoPrivacy, VideoStreamingPlaylistType } from '@peertube/peertube-models'

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
