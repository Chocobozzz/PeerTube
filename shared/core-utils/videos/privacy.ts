import { VideoDetails } from '../../models/videos/video.model'
import { VideoPrivacy } from '../../models/videos/video-privacy.enum'

function getAllPrivacies () {
  return [ VideoPrivacy.PUBLIC, VideoPrivacy.INTERNAL, VideoPrivacy.PRIVATE, VideoPrivacy.UNLISTED ]
}

function getAllFiles (video: Partial<Pick<VideoDetails, 'files' | 'streamingPlaylists'>>) {
  const files = video.files

  if (video.streamingPlaylists[0]) {
    return files.concat(video.streamingPlaylists[0].files)
  }

  return files
}

export {
  getAllPrivacies,
  getAllFiles
}
