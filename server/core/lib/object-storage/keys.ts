import { join } from 'path'
import { MStreamingPlaylistVideo } from '@server/types/models/index.js'

function generateHLSObjectStorageKey (playlist: MStreamingPlaylistVideo, filename: string) {
  return join(generateHLSObjectBaseStorageKey(playlist), filename)
}

function generateHLSObjectBaseStorageKey (playlist: MStreamingPlaylistVideo) {
  return join(playlist.getStringType(), playlist.Video.uuid)
}

function generateWebVideoObjectStorageKey (filename: string) {
  return filename
}

function generateUserExportObjectStorageKey (filename: string) {
  return filename
}

export {
  generateHLSObjectStorageKey,
  generateHLSObjectBaseStorageKey,
  generateWebVideoObjectStorageKey,
  generateUserExportObjectStorageKey
}
