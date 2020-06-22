import { ActivityPubActor } from './activitypub-actor'
import { ActivityPubSignature } from './activitypub-signature'
import { CacheFileObject, VideoTorrentObject, ActivityFlagReasonObject } from './objects'
import { DislikeObject } from './objects/dislike-object'
import { VideoAbuseObject } from './objects/video-abuse-object'
import { VideoCommentObject } from './objects/video-comment-object'
import { ViewObject } from './objects/view-object'
import { APObject } from './objects/object.model'
import { PlaylistObject } from './objects/playlist-object'

export type Activity =
  ActivityCreate |
  ActivityUpdate |
  ActivityDelete |
  ActivityFollow |
  ActivityAccept |
  ActivityAnnounce |
  ActivityUndo |
  ActivityLike |
  ActivityReject |
  ActivityView |
  ActivityDislike |
  ActivityFlag

export type ActivityType =
  'Create' |
  'Update' |
  'Delete' |
  'Follow' |
  'Accept' |
  'Announce' |
  'Undo' |
  'Like' |
  'Reject' |
  'View' |
  'Dislike' |
  'Flag'

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
  object: VideoTorrentObject | VideoAbuseObject | ViewObject | DislikeObject | VideoCommentObject | CacheFileObject | PlaylistObject
}

export interface ActivityUpdate extends BaseActivity {
  type: 'Update'
  object: VideoTorrentObject | ActivityPubActor | CacheFileObject | PlaylistObject
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
  object: APObject
}

export interface ActivityUndo extends BaseActivity {
  type: 'Undo'
  object: ActivityFollow | ActivityLike | ActivityDislike | ActivityCreate | ActivityAnnounce
}

export interface ActivityLike extends BaseActivity {
  type: 'Like'
  object: APObject
}

export interface ActivityView extends BaseActivity {
  type: 'View'
  actor: string
  object: APObject
}

export interface ActivityDislike extends BaseActivity {
  id: string
  type: 'Dislike'
  actor: string
  object: APObject
}

export interface ActivityFlag extends BaseActivity {
  type: 'Flag'
  content: string
  object: APObject | APObject[]
  tag?: ActivityFlagReasonObject[]
  startAt?: number
  endAt?: number
}
