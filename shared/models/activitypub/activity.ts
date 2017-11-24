import { ActivityPubSignature } from './activitypub-signature'
import { VideoChannelObject, VideoTorrentObject } from './objects'
import { DislikeObject } from './objects/dislike-object'
import { VideoAbuseObject } from './objects/video-abuse-object'
import { ViewObject } from './objects/view-object'

export type Activity = ActivityCreate | ActivityAdd | ActivityUpdate |
  ActivityDelete | ActivityFollow | ActivityAccept | ActivityAnnounce |
  ActivityUndo | ActivityLike

export type ActivityType = 'Create' | 'Add' | 'Update' | 'Delete' | 'Follow' | 'Accept' | 'Announce' | 'Undo' | 'Like'

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
  object: VideoChannelObject | VideoAbuseObject | ViewObject | DislikeObject
}

export interface ActivityAdd extends BaseActivity {
  type: 'Add'
  target: string
  object: VideoTorrentObject
}

export interface ActivityUpdate extends BaseActivity {
  type: 'Update'
  object: VideoTorrentObject | VideoChannelObject
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
}

export interface ActivityAnnounce extends BaseActivity {
  type: 'Announce'
  object: ActivityCreate | ActivityAdd
}

export interface ActivityUndo extends BaseActivity {
  type: 'Undo',
  object: ActivityFollow | ActivityLike | ActivityCreate
}

export interface ActivityLike extends BaseActivity {
  type: 'Like',
  object: string
}
