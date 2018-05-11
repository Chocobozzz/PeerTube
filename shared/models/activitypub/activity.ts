import { ActivityPubActor } from './activitypub-actor'
import { ActivityPubSignature } from './activitypub-signature'
import { VideoTorrentObject } from './objects'
import { DislikeObject } from './objects/dislike-object'
import { VideoAbuseObject } from './objects/video-abuse-object'
import { VideoCommentObject } from './objects/video-comment-object'
import { ViewObject } from './objects/view-object'

export type Activity = ActivityCreate | ActivityUpdate |
  ActivityDelete | ActivityFollow | ActivityAccept | ActivityAnnounce |
  ActivityUndo | ActivityLike | ActivityReject

export type ActivityType = 'Create' | 'Update' | 'Delete' | 'Follow' | 'Accept' | 'Announce' | 'Undo' | 'Like' | 'Reject'

export interface ActivityAudience {
  to: string[]
  cc: string[]
}

export interface BaseActivity {
  '@context'?: any[]
  id: string
  to?: string[]
  cc?: string[]
  actor: string | ActivityPubActor
  type: ActivityType
  signature?: ActivityPubSignature
}

export interface ActivityCreate extends BaseActivity {
  type: 'Create'
  object: VideoTorrentObject | VideoAbuseObject | ViewObject | DislikeObject | VideoCommentObject
}

export interface ActivityUpdate extends BaseActivity {
  type: 'Update'
  object: VideoTorrentObject | ActivityPubActor
}

export interface ActivityDelete extends BaseActivity {
  type: 'Delete'
  object: string | { id: string }
}

export interface ActivityFollow extends BaseActivity {
  type: 'Follow'
  object: string
}

export interface ActivityAccept extends BaseActivity {
  type: 'Accept'
  object: ActivityFollow
}

export interface ActivityReject extends BaseActivity {
  type: 'Reject'
  object: ActivityFollow
}

export interface ActivityAnnounce extends BaseActivity {
  type: 'Announce'
  object: string | { id: string }
}

export interface ActivityUndo extends BaseActivity {
  type: 'Undo',
  object: ActivityFollow | ActivityLike | ActivityCreate | ActivityAnnounce
}

export interface ActivityLike extends BaseActivity {
  type: 'Like',
  object: string
}
