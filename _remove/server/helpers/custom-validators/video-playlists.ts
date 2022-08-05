import { exists } from './misc'
import validator from 'validator'
import { CONSTRAINTS_FIELDS, VIDEO_PLAYLIST_PRIVACIES, VIDEO_PLAYLIST_TYPES } from '../../initializers/constants'

const PLAYLISTS_CONSTRAINT_FIELDS = CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS

function isVideoPlaylistNameValid (value: any) {
  return exists(value) && validator.isLength(value, PLAYLISTS_CONSTRAINT_FIELDS.NAME)
}

function isVideoPlaylistDescriptionValid (value: any) {
  return value === null || (exists(value) && validator.isLength(value, PLAYLISTS_CONSTRAINT_FIELDS.DESCRIPTION))
}

function isVideoPlaylistPrivacyValid (value: number) {
  return validator.isInt(value + '') && VIDEO_PLAYLIST_PRIVACIES[value] !== undefined
}

function isVideoPlaylistTimestampValid (value: any) {
  return value === null || (exists(value) && validator.isInt('' + value, { min: 0 }))
}

function isVideoPlaylistTypeValid (value: any) {
  return exists(value) && VIDEO_PLAYLIST_TYPES[value] !== undefined
}

// ---------------------------------------------------------------------------

export {
  isVideoPlaylistNameValid,
  isVideoPlaylistDescriptionValid,
  isVideoPlaylistPrivacyValid,
  isVideoPlaylistTimestampValid,
  isVideoPlaylistTypeValid
}
