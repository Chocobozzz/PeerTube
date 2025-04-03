import { VideoPlaylistModel } from '@server/models/video/video-playlist.js'
import { MVideoPlaylistFullSummary } from '@server/types/models/index.js'
import { getAPId } from '../activity.js'
import { createOrUpdateVideoPlaylist } from './create-update.js'
import { scheduleRefreshIfNeeded } from './refresh.js'
import { fetchRemoteVideoPlaylist } from './shared/index.js'

export async function getOrCreateAPVideoPlaylist (playlistUrl: string): Promise<MVideoPlaylistFullSummary> {
  const playlistFromDatabase = await VideoPlaylistModel.loadByUrlWithAccountAndChannelSummary(playlistUrl)

  if (playlistFromDatabase) {
    scheduleRefreshIfNeeded(playlistFromDatabase)

    return playlistFromDatabase
  }

  const { playlistObject } = await fetchRemoteVideoPlaylist(playlistUrl)
  if (!playlistObject) throw new Error('Cannot fetch remote playlist with url: ' + playlistUrl)

  // playlistUrl is just an alias/redirection, so process object id instead
  if (playlistObject.id !== playlistUrl) return getOrCreateAPVideoPlaylist(getAPId(playlistObject))

  const playlistCreated = await createOrUpdateVideoPlaylist({ playlistObject, contextUrl: playlistUrl })

  return playlistCreated
}
