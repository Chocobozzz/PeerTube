import { exists, checkDate, catchErrorAsBoolean } from '../misc'
import { PlaylistObject } from '../../../../shared/models/activitypub/objects/playlist-object'
import validator from 'validator'
import { PlaylistElementObject } from '../../../../shared/models/activitypub/objects/playlist-element-object'
import { isActivityPubUrlValid } from './misc'

function isPlaylistObjectValid (object: PlaylistObject) {
  return exists(object) &&
    object.type === 'Playlist' &&
    validator.isInt(object.totalItems + '') &&
    catchErrorAsBoolean(checkDate)(object.published) &&
    catchErrorAsBoolean(checkDate)(object.updated)
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
