import { join } from 'path'
import { MStreamingPlaylistVideo } from '@server/types/models/index.js'

export function generateHLSObjectStorageKey (playlist: MStreamingPlaylistVideo, filename: string) {
  return join(generateHLSObjectBaseStorageKey(playlist), filename)
}

export function generateHLSObjectBaseStorageKey (playlist: MStreamingPlaylistVideo) {
  return join(playlist.getStringType(), playlist.Video.uuid)
}

export function generateWebVideoObjectStorageKey (filename: string) {
  return filename
}

export function generateOriginalVideoObjectStorageKey (filename: string) {
  return filename
}

export function generateCaptionObjectStorageKey (filename: string) {
  return filename
}

export function generateUserExportObjectStorageKey (filename: string) {
  return filename
}
