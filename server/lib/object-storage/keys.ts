import { join } from 'path'
import { MStreamingPlaylist, MVideoUUID } from '@server/types/models'

function generateHLSObjectStorageKey (playlist: MStreamingPlaylist, video: MVideoUUID, filename?: string) {
  const base = playlist.getStringType() + '_' + video.uuid

  if (!filename) return base

  return join(base, filename)
}

function generateWebTorrentObjectStorageKey (filename: string) {
  return filename
}

export {
  generateHLSObjectStorageKey,
  generateWebTorrentObjectStorageKey
}
