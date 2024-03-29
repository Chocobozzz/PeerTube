import { ActivityPubActor } from './activitypub-actor.js'
import { ActivityPubSignature } from './activitypub-signature.js'
import {
  ActivityFlagReasonObject,
  ActivityObject,
  APObjectId,
  CacheFileObject,
  PlaylistObject,
  VideoCommentObject,
  VideoObject,
  WatchActionObject
} from './objects/index.js'

export type ActivityUpdateObject =
  Extract<ActivityObject, VideoObject | CacheFileObject | PlaylistObject | ActivityPubActor | string> | ActivityPubActor

// Cannot Extract from Activity because of circular reference
export type ActivityUndoObject =
  ActivityFollow | ActivityLike | ActivityDislike | ActivityCreate<CacheFileObject | string> | ActivityAnnounce

export type ActivityCreateObject =
  Extract<ActivityObject, VideoObject | CacheFileObject | WatchActionObject | VideoCommentObject | PlaylistObject | string>

export type Activity =
  ActivityCreate<ActivityCreateObject> |
  ActivityUpdate<ActivityUpdateObject> |
  ActivityDelete |
  ActivityFollow |
  ActivityAccept |
  ActivityAnnounce |
  ActivityUndo<ActivityUndoObject> |
  ActivityLike |
  ActivityReject |
  ActivityView |
  ActivityDislike |
  ActivityFlag |
  ActivityApproveReply |
  ActivityRejectReply

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
  'Flag' |
  'ApproveReply' |
  'RejectReply'

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

export interface ActivityCreate <T extends ActivityCreateObject> extends BaseActivity {
  type: 'Create'
  object: T
}

export interface ActivityUpdate <T extends ActivityUpdateObject> extends BaseActivity {
  type: 'Update'
  object: T
}

export interface ActivityDelete extends BaseActivity {
  type: 'Delete'
  object: APObjectId
}

export interface ActivityFollow extends BaseActivity {
  type: 'Follow'
  object: string
}

export interface ActivityAccept extends BaseActivity {
  type: 'Accept'
  object: ActivityFollow
}

export interface ActivityApproveReply extends BaseActivity {
  type: 'ApproveReply'
  object: string
  inReplyTo: string
}

export interface ActivityRejectReply extends BaseActivity {
  type: 'RejectReply'
  object: string
  inReplyTo: string
}

export interface ActivityReject extends BaseActivity {
  type: 'Reject'
  object: ActivityFollow
}

export interface ActivityAnnounce extends BaseActivity {
  type: 'Announce'
  object: APObjectId
}

export interface ActivityUndo <T extends ActivityUndoObject> extends BaseActivity {
  type: 'Undo'
  object: T
}

export interface ActivityLike extends BaseActivity {
  type: 'Like'
  object: APObjectId
}

export interface ActivityView extends BaseActivity {
  type: 'View'
  actor: string
  object: APObjectId

  // If sending a "viewer" event
  expires?: string
  result?: {
    type: 'InteractionCounter'
    interactionType: 'WatchAction'
    userInteractionCount: number
  }
}

export interface ActivityDislike extends BaseActivity {
  id: string
  type: 'Dislike'
  actor: string
  object: APObjectId
}

export interface ActivityFlag extends BaseActivity {
  type: 'Flag'
  content: string
  object: APObjectId | APObjectId[]
  tag?: ActivityFlagReasonObject[]
  startAt?: number
  endAt?: number
}
