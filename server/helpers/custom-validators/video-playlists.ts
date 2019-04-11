import { exists } from './misc'
import * as validator from 'validator'
import { CONSTRAINTS_FIELDS, VIDEO_PLAYLIST_PRIVACIES, VIDEO_PLAYLIST_TYPES } from '../../initializers/constants'
import * as express from 'express'
import { VideoPlaylistModel } from '../../models/video/video-playlist'

const PLAYLISTS_CONSTRAINT_FIELDS = CONSTRAINTS_FIELDS.VIDEO_PLAYLISTS

function isVideoPlaylistNameValid (value: any) {
  return exists(value) && validator.isLength(value, PLAYLISTS_CONSTRAINT_FIELDS.NAME)
}

function isVideoPlaylistDescriptionValid (value: any) {
  return value === null || (exists(value) && validator.isLength(value, PLAYLISTS_CONSTRAINT_FIELDS.DESCRIPTION))
}

function isVideoPlaylistPrivacyValid (value: number) {
  return validator.isInt(value + '') && VIDEO_PLAYLIST_PRIVACIES[ value ] !== undefined
}

function isVideoPlaylistTimestampValid (value: any) {
  return value === null || (exists(value) && validator.isInt('' + value, { min: 0 }))
}

function isVideoPlaylistTypeValid (value: any) {
  return exists(value) && VIDEO_PLAYLIST_TYPES[ value ] !== undefined
}

async function doesVideoPlaylistExist (id: number | string, res: express.Response, fetchType: 'summary' | 'all' = 'summary') {
  const videoPlaylist = fetchType === 'summary'
    ? await VideoPlaylistModel.loadWithAccountAndChannelSummary(id, undefined)
    : await VideoPlaylistModel.loadWithAccountAndChannel(id, undefined)

  if (!videoPlaylist) {
    res.status(404)
       .json({ error: 'Video playlist not found' })
       .end()

    return false
  }

  res.locals.videoPlaylist = videoPlaylist
  return true
}

// ---------------------------------------------------------------------------

export {
  doesVideoPlaylistExist,
  isVideoPlaylistNameValid,
  isVideoPlaylistDescriptionValid,
  isVideoPlaylistPrivacyValid,
  isVideoPlaylistTimestampValid,
  isVideoPlaylistTypeValid
}
