import { join } from 'path'
import { MStreamingPlaylist, MVideoUUID } from '@server/types/models'

function generateHLSObjectStorageKey (playlist: MStreamingPlaylist, video: MVideoUUID, filename: string) {
  return join(generateHLSObjectBaseStorageKey(playlist, video), filename)
}

function generateHLSObjectBaseStorageKey (playlist: MStreamingPlaylist, video: MVideoUUID) {
  return join(playlist.getStringType(), video.uuid)
}

function generateWebTorrentObjectStorageKey (filename: string) {
  return filename
}

export {
  generateHLSObjectStorageKey,
  generateHLSObjectBaseStorageKey,
  generateWebTorrentObjectStorageKey
}
