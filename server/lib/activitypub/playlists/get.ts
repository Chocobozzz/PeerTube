import { VideoPlaylistModel } from '@server/models/video/video-playlist'
import { MVideoPlaylistFullSummary } from '@server/types/models'
import { APObjectId } from '@shared/models'
import { getAPId } from '../activity'
import { createOrUpdateVideoPlaylist } from './create-update'
import { scheduleRefreshIfNeeded } from './refresh'
import { fetchRemoteVideoPlaylist } from './shared'

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
