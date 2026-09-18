import { publishToRedis, subscribeToRedis } from './redis-client.js'

/**
 * Secondary processes on another host than the primary check whether every file of a given kind is in object storage
 * The primary notifies them when files are moved, so they can check it again
 */

const SHARED_FILES_CHANNEL = 'shared-files-changed'

export type SharedFilesChange = 'moved-to-object-storage' | 'moved-to-file-system'

export function publishSharedFilesChanged (change: SharedFilesChange) {
  return publishToRedis(SHARED_FILES_CHANNEL, change)
}

export function subscribeToSharedFilesChanges (handler: (change: SharedFilesChange) => void) {
  return subscribeToRedis(SHARED_FILES_CHANNEL, message => handler(message as SharedFilesChange))
}
