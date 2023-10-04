import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { MVideoPlaylistFullSummary } from '@server/types/models/index.js'
import { APObjectId } from '@peertube/peertube-models'
import { getAPId } from '../activity.js'
import { createOrUpdateVideoPlaylist } from './create-update.js'
import { scheduleRefreshIfNeeded } from './refresh.js'
import { fetchRemoteVideoPlaylist } from './shared/index.js'

async function getOrCreateAPVideoPlaylist (playlistObjectArg: APObjectId): Promise<MVideoPlaylistFullSummary> {
  const playlistUrl = getAPId(playlistObjectArg)

  const playlistFromDatabase = await VideoPlaylistModel.loadByUrlWithAccountAndChannelSummary(playlistUrl)

  if (playlistFromDatabase) {
    scheduleRefreshIfNeeded(playlistFromDatabase)

    return playlistFromDatabase
  }

  const { playlistObject } = await fetchRemoteVideoPlaylist(playlistUrl)
  if (!playlistObject) throw new Error('Cannot fetch remote playlist with url: ' + playlistUrl)

  // playlistUrl is just an alias/redirection, so process object id instead
  if (playlistObject.id !== playlistUrl) return getOrCreateAPVideoPlaylist(playlistObject)

  const playlistCreated = await createOrUpdateVideoPlaylist(playlistObject)

  return playlistCreated
}

// ---------------------------------------------------------------------------

export {
  getOrCreateAPVideoPlaylist
}
