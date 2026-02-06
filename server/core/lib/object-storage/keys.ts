import { VideoStreamingPlaylistTypeString } from '@peertube/peertube-models'
import { MVideoUUID } from '@server/types/models/index.js'
import { join } from 'path'

export function generateHLSObjectStorageKey (video: MVideoUUID, filename: string) {
  return join(generateHLSObjectBaseStorageKey(video), filename)
}

export function generateHLSObjectBaseStorageKey (video: MVideoUUID) {
  return join('hls' satisfies VideoStreamingPlaylistTypeString, video.uuid)
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
