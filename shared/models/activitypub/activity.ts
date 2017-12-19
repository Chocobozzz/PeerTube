import { ActivityPubSignature } from './activitypub-signature'
import { VideoTorrentObject } from './objects'
import { DislikeObject } from './objects/dislike-object'
import { VideoAbuseObject } from './objects/video-abuse-object'
import { ViewObject } from './objects/view-object'

export type Activity = ActivityCreate | ActivityUpdate |
  ActivityDelete | ActivityFollow | ActivityAccept | ActivityAnnounce |
  ActivityUndo | ActivityLike

export type ActivityType = 'Create' | 'Update' | 'Delete' | 'Follow' | 'Accept' | 'Announce' | 'Undo' | 'Like'

export interface ActivityAudience {
  to: string[]
  cc: string[]
}

export interface BaseActivity {
  '@context'?: any[]
  id: string
  to?: string[]
  cc?: string[]
  actor: string
  type: ActivityType
  signature?: ActivityPubSignature
}

export interface ActivityCreate extends BaseActivity {
  type: 'Create'
  object: VideoTorrentObject | VideoAbuseObject | ViewObject | DislikeObject
}

export interface ActivityUpdate extends BaseActivity {
  type: 'Update'
  object: VideoTorrentObject
}

export interface ActivityDelete extends BaseActivity {
  type: 'Delete'
}

export interface ActivityFollow extends BaseActivity {
  type: 'Follow'
  object: string
}

export interface ActivityAccept extends BaseActivity {
  type: 'Accept'
  object: ActivityFollow
}

export interface ActivityAnnounce extends BaseActivity {
  type: 'Announce'
  object: ActivityCreate
}

export interface ActivityUndo extends BaseActivity {
  type: 'Undo',
  object: ActivityFollow | ActivityLike | ActivityCreate
}

export interface ActivityLike extends BaseActivity {
  type: 'Like',
  object: string
}
