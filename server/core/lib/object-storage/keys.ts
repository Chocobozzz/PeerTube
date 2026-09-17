import { VideoStreamingPlaylistTypeString } from '@peertube/peertube-models'
import { MVideoUUID } from '@server/types/models/index.js'
import { join } from 'path'
import type { ObjectStorageFileType } from './config.js'

export function generateHLSObjectStorageKey (video: MVideoUUID, filename: string) {
  if (!isSafeKey(filename)) throw new Error('Invalid filename ' + filename + ' for HLS object storage key generation')

  return join(generateHLSObjectBaseStorageKey(video), filename)
}

export function generateHLSObjectBaseStorageKey (video: MVideoUUID) {
  return join('hls' satisfies VideoStreamingPlaylistTypeString, video.uuid)
}

export function generateCommonFileObjectStorageKey (type: ObjectStorageFileType, filename: string) {
  if (!isSafeKey(filename)) throw new Error('Invalid filename ' + filename + ' for ' + type + ' object storage key generation')

  return filename
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isSafeKey (key: string) {
  const regex = new RegExp(`^[a-zA-Z0-9-:.]+\\.[a-z0-9]{1,8}$`)

  return typeof key === 'string' && !!key.match(regex)
}
