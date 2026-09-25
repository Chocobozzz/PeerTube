import { LiveVideoErrorType, ProcessRole } from '@peertube/peertube-models'
import { SHARED_CONFIG_REDIS_CHANNEL } from '../../initializers/config/shared-config.js'
import { RedisChannel } from './redis-channel.js'

export type JobQueueStatePayload = {
  action: 'pause' | 'resume'
  processRoles: ProcessRole[]

  // The sender already applied the change
  senderId: string
}

export type LiveSessionStopPayload = {
  videoUUID: string
  error: LiveVideoErrorType | null

  expectedSessionId?: string // Prevent stopping another session of permanent live
  errorOnReplay?: boolean
}

export type ModelCacheInvalidationPayload =
  // A model was updated or deleted
  | { type: 'delete-key', deleteKey: string, modelId: number }
  // Every entry of a cache type must go (instance actor images changed...)
  | { type: 'cache-type', cacheType: string }

export type PluginChangePayload =
  // The primary installed, updated or uninstalled a plugin/theme
  | { type: 'installed-plugins-changed' }
  // An admin changed the settings of a plugin (`onSettingsChange` callbacks must run on every process)
  | { type: 'plugin-settings-changed', npmName: string }

// Secondary processes on another host than the primary check whether every file of a given kind is in object storage
// The primary notifies them when files are moved, so they can check it again
export type SharedFilesChange = 'moved-to-object-storage' | 'moved-to-file-system'

export type TokenInvalidationPayload = {
  token?: string
  userId?: number
  tokenException?: string
}

export type WatchedWordsInvalidationPayload = {
  accountId: number
}

export const RedisChannels = {
  // The primary published its configuration: the other processes read it again
  configChanged: new RedisChannel(SHARED_CONFIG_REDIS_CHANNEL),

  // No payload: processes reload the homepage from the database, so concurrent updates cannot be applied out of order
  homepageChanged: new RedisChannel('homepage-changes'),

  jobQueueState: new RedisChannel<JobQueueStatePayload>('job-queue-state'),
  liveSessionStop: new RedisChannel<LiveSessionStopPayload>('live-session-stop'),
  modelCacheInvalidation: new RedisChannel<ModelCacheInvalidationPayload>('model-cache-invalidation'),
  pluginChanges: new RedisChannel<PluginChangePayload>('plugin-changes'),
  sharedFilesChanged: new RedisChannel<SharedFilesChange>('shared-files-changed'),
  tokenInvalidation: new RedisChannel<TokenInvalidationPayload>('token-invalidation'),
  watchedWordsInvalidation: new RedisChannel<WatchedWordsInvalidationPayload>('watched-words-invalidation')
}
