import validator from 'validator'
import { PlaylistElementObject, PlaylistObject } from '@peertube/peertube-models'
import { exists, isDateValid, isUUIDValid } from '../misc.js'
import { isVideoPlaylistNameValid } from '../video-playlists.js'
import { isActivityPubUrlValid } from './misc.js'

function isPlaylistObjectValid (object: PlaylistObject) {
  return exists(object) &&
    object.type === 'Playlist' &&
    validator.default.isInt(object.totalItems + '') &&
    isVideoPlaylistNameValid(object.name) &&
    isUUIDValid(object.uuid) &&
    isDateValid(object.published) &&
    isDateValid(object.updated)
}

function isPlaylistElementObjectValid (object: PlaylistElementObject) {
  return exists(object) &&
    object.type === 'PlaylistElement' &&
    validator.default.isInt(object.position + '') &&
    isActivityPubUrlValid(object.url)
}

// ---------------------------------------------------------------------------

export {
  isPlaylistObjectValid,
  isPlaylistElementObjectValid
}
