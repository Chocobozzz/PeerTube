export const AuditLogAction = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete'
} as const

export type AuditLogActionType = typeof AuditLogAction[keyof typeof AuditLogAction]

export const AuditLogEntityType = {
  // Videos
  VIDEO: 'video',
  VIDEO_IMPORT: 'video-import',
  VIDEO_LIVE: 'video-live',
  VIDEO_SOURCE: 'video-source',
  VIDEO_FILE: 'video-file',
  VIDEO_CAPTION: 'video-caption',
  VIDEO_CHAPTERS: 'video-chapters',
  VIDEO_PASSWORD: 'video-password',
  VIDEO_EMBED_PRIVACY: 'video-embed-privacy',
  VIDEO_TRANSCODING: 'video-transcoding',
  VIDEO_TRANSCRIPTION: 'video-transcription',
  VIDEO_STUDIO_EDITION: 'video-studio-edition',
  VIDEO_PLAYER_SETTINGS: 'video-player-settings',
  OWNERSHIP_CHANGE: 'ownership-change',
  COMMENT: 'comment',

  // Channels and playlists
  CHANNEL: 'channel',
  CHANNEL_SYNC: 'channel-sync',
  CHANNEL_VIDEOS_IMPORT: 'channel-videos-import',
  CHANNEL_COLLABORATOR: 'channel-collaborator',
  CHANNEL_PLAYER_SETTINGS: 'channel-player-settings',
  CHANNEL_PLAYLISTS_ORDER: 'channel-playlists-order',
  PLAYLIST: 'playlist',
  PLAYLIST_ELEMENT: 'playlist-element',
  PLAYLIST_ELEMENTS_ORDER: 'playlist-elements-order',

  // Users and account security
  USER: 'user',
  REGISTRATION: 'registration',
  PASSWORD_RESET: 'password-reset',
  TOKEN_SESSION: 'token-session',
  FAILED_LOGIN: 'failed-login',
  SCOPED_TOKEN: 'scoped-token',
  USER_EXPORT: 'user-export',
  USER_IMPORT: 'user-import',

  // Moderation
  ABUSE: 'abuse',
  ABUSE_MESSAGE: 'abuse-message',
  VIDEO_BLOCK: 'video-block',
  ACCOUNT_BLOCK: 'account-block',
  SERVER_BLOCK: 'server-block',
  BLOCKLIST_SUBSCRIPTION: 'blocklist-subscription',
  WATCHED_WORDS_LIST: 'watched-words-list',
  WATCHED_WORDS_SUBSCRIPTION: 'watched-words-subscription',
  AUTOMATIC_TAG_POLICY: 'automatic-tag-policy',

  // Administration
  CONFIG: 'config',
  INSTANCE_IMAGE: 'instance-image',
  INSTANCE_HOMEPAGE: 'instance-homepage',
  INSTANCE_HOST: 'instance-host',
  PLUGIN: 'plugin',
  FOLLOW: 'follow',
  SERVER_REDUNDANCY: 'server-redundancy',
  VIDEO_REDUNDANCY: 'video-redundancy',
  JOB_QUEUE: 'job-queue',
  JOB: 'job',
  RUNNER: 'runner',
  RUNNER_REGISTRATION_TOKEN: 'runner-registration-token',
  DEBUG_COMMAND: 'debug-command',
  STORAGE_PRUNE: 'storage-prune'
} as const

export type AuditLogEntityTypeType = typeof AuditLogEntityType[keyof typeof AuditLogEntityType]

export interface AuditLogChange {
  old: any
  new: any
}

export interface AuditLog {
  id: number

  action: AuditLogActionType
  entityType: AuditLogEntityTypeType

  // null for entities that don't have an id (instance config)
  entityId: number | null

  user: {
    // null if the user has been deleted, for remote actors or for entries imported from the legacy audit log files
    id: number | null

    // Local username, actor handle for remote actors or custom roles: (`anonymous`, `cli`, `plugin:<npm name>`, `runner:<runner name>`)
    username: string
  }

  ip: string | null

  // Snapshot of the entity after the action (before the action for deletions)
  entity: Record<string, any>

  // Only for updates
  changes: Record<string, AuditLogChange> | null

  createdAt: Date | string

  // ---------------------------------------------------------------------------
  // Below are the legacy format
  // ---------------------------------------------------------------------------

  /**
   * @deprecated 9.0, use createdAt
   */
  timestamp: string

  /**
   * @deprecated 9.0
   */
  level: 'audit'

  /**
   * JSON string containing user, domain (entity type), action, entityId, ip, changes and the entity attributes
   * @deprecated 9.0, use the other fields
   */
  message: string
}
