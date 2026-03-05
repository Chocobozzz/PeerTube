import { PlaylistElementObject, PlaylistObject } from '@peertube/peertube-models'
import validator from 'validator'
import { exists, isDateValid, isUUIDValid } from '../misc.js'
import { isVideoPlaylistNameValid } from '../video-playlists.js'
import { isActivityPubUrlValid, setValidAttributedTo } from './misc.js'

export function isPlaylistObjectValid (object: PlaylistObject) {
  if (object?.type !== 'Playlist') return false

  setValidAttributedTo(object)

  return validator.default.isInt(object.totalItems + '') &&
    isVideoPlaylistNameValid(object.name) &&
    isUUIDValid(object.uuid) &&
    isDateValid(object.published) &&
    isDateValid(object.updated) &&
    (!exists(object.audience) || isActivityPubUrlValid(object.audience))
}

export function isPlaylistElementObjectValid (object: PlaylistElementObject) {
  return exists(object) &&
    object.type === 'PlaylistElement' &&
    validator.default.isInt(object.position + '') &&
    isActivityPubUrlValid(object.url)
}
