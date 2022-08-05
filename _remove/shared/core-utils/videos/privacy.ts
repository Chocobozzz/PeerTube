import { VideoPrivacy } from '../../models/videos/video-privacy.enum'

function getAllPrivacies () {
  return [ VideoPrivacy.PUBLIC, VideoPrivacy.INTERNAL, VideoPrivacy.PRIVATE, VideoPrivacy.UNLISTED ]
}

export {
  getAllPrivacies
}
