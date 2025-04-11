import { MStreamingPlaylistVideoUUID } from '@server/types/models/index.js'
import { join } from 'path'

export function generateHLSObjectStorageKey (playlist: MStreamingPlaylistVideoUUID, filename: string) {
  return join(generateHLSObjectBaseStorageKey(playlist), filename)
}

export function generateHLSObjectBaseStorageKey (playlist: MStreamingPlaylistVideoUUID) {
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
