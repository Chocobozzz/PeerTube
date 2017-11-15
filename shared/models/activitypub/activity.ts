import { VideoChannelObject, VideoTorrentObject } from './objects'
import { ActivityPubSignature } from './activitypub-signature'
import { VideoAbuseObject } from './objects/video-abuse-object'

export type Activity = ActivityCreate | ActivityAdd | ActivityUpdate | ActivityFlag |
  ActivityDelete | ActivityFollow | ActivityAccept | ActivityAnnounce

// Flag -> report abuse
export type ActivityType = 'Create' | 'Add' | 'Update' | 'Flag' | 'Delete' | 'Follow' | 'Accept' | 'Announce'

export interface BaseActivity {
  '@context'?: any[]
  id: string
  to: string[]
  actor: string
  type: ActivityType
  signature: ActivityPubSignature
}

export interface ActivityCreate extends BaseActivity {
  type: 'Create'
  object: VideoChannelObject | VideoAbuseObject
}

export interface ActivityAdd extends BaseActivity {
  type: 'Add'
  object: VideoTorrentObject
}

export interface ActivityUpdate extends BaseActivity {
  type: 'Update'
  object: VideoTorrentObject | VideoChannelObject
}

export interface ActivityFlag extends BaseActivity {
  type: 'Flag'
  object: string
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
  object: VideoChannelObject | VideoTorrentObject
}
