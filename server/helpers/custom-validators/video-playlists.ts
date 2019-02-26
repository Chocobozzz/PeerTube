import { exists } from './misc'
import * as validator from 'validator'
import { CONSTRAINTS_FIELDS, VIDEO_PLAYLIST_PRIVACIES } from '../../initializers'
import * as express from 'express'
import { VideoPlaylistModel } from '../../models/video/video-playlist'
import { VideoPlaylistElementModel } from '../../models/video/video-playlist-element'

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

async function isVideoPlaylistExist (id: number | string, res: express.Response) {
  const videoPlaylist = await VideoPlaylistModel.load(id, undefined)

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
  isVideoPlaylistExist,
  isVideoPlaylistNameValid,
  isVideoPlaylistDescriptionValid,
  isVideoPlaylistPrivacyValid
}
