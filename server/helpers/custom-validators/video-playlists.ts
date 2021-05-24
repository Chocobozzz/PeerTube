import { exists, checkArrayWith, checkId } from './misc'
import validator from 'validator'
import { CONSTRAINTS_FIELDS, VIDEO_PLAYLIST_PRIVACIES, VIDEO_PLAYLIST_TYPES } from '../../initializers/constants'

const PLAYLISTS_CONSTRAINT_FIELDS = CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS

function checkVideoPlaylistName (value: any) {
  if (!exists(value)) throw new Error('Should have a non-null playlist name')
  if (!validator.isLength(value, PLAYLISTS_CONSTRAINT_FIELDS.NAME)) {
    const min = PLAYLISTS_CONSTRAINT_FIELDS.NAME.min
    const max = PLAYLISTS_CONSTRAINT_FIELDS.NAME.max
    throw new Error(`Should have a video playlist name between ${min} and ${max} characters long`)
  }
  return true
}

function checkVideoPlaylistDescription (value: any) {
  if (value === null) return true
  if (!exists(value)) throw new Error('Should have a non-null playlist description')
  if (!validator.isLength(value, PLAYLISTS_CONSTRAINT_FIELDS.DESCRIPTION)) {
    const min = PLAYLISTS_CONSTRAINT_FIELDS.DESCRIPTION.min
    const max = PLAYLISTS_CONSTRAINT_FIELDS.DESCRIPTION.max
    throw new Error(`Should have a video playlist description text between ${min} and ${max} characters long`)
  }
  return true
}

function checkVideoPlaylistPrivacy (value: number) {
  if (!validator.isInt(value + '')) throw new Error('Should have a privacy policy that is an integer')
  if (VIDEO_PLAYLIST_PRIVACIES[value] === undefined) throw new Error('Should have a privacy policy that corresponds to a known value')
  return true
}

function checkVideoPlaylistTimestamp (value: any) {
  if (value === null) return true
  if (!exists(value)) throw new Error('Should have a non-null timestamp')
  if (!validator.isInt('' + value, { min: 0 })) throw new Error('Should have a timestamp that is a positive integer')
  return true
}

function checkVideoPlaylistType (value: any) {
  if (!exists(value)) throw new Error('Should have a non-null type')
  if (VIDEO_PLAYLIST_TYPES[value] === undefined) throw new Error('Should have a known playlist type')
  return true
}

function checkVideoPlaylistVideoIds (value: any) {
  return checkArrayWith(value, checkId)
}

// ---------------------------------------------------------------------------

export {
  checkVideoPlaylistName,
  checkVideoPlaylistDescription,
  checkVideoPlaylistPrivacy,
  checkVideoPlaylistTimestamp,
  checkVideoPlaylistType,
  checkVideoPlaylistVideoIds
}
