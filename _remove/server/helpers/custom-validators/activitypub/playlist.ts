import validator from 'validator'
import { PlaylistElementObject, PlaylistObject } from '@shared/models'
import { exists, isDateValid, isUUIDValid } from '../misc'
import { isVideoPlaylistNameValid } from '../video-playlists'
import { isActivityPubUrlValid } from './misc'

function isPlaylistObjectValid (object: PlaylistObject) {
  return exists(object) &&
    object.type === 'Playlist' &&
    validator.isInt(object.totalItems + '') &&
    isVideoPlaylistNameValid(object.name) &&
    isUUIDValid(object.uuid) &&
    isDateValid(object.published) &&
    isDateValid(object.updated)
}

function isPlaylistElementObjectValid (object: PlaylistElementObject) {
  return exists(object) &&
    object.type === 'PlaylistElement' &&
    validator.isInt(object.position + '') &&
    isActivityPubUrlValid(object.url)
}

// ---------------------------------------------------------------------------

export {
  isPlaylistObjectValid,
  isPlaylistElementObjectValid
}
