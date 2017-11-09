import {
  VideoChannelObject,
  VideoTorrentObject
} from './objects'
import { ActivityPubSignature } from './activitypub-signature'

export type Activity = ActivityCreate | ActivityUpdate | ActivityFlag

// Flag -> report abuse
export type ActivityType = 'Create' | 'Update' | 'Flag'

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
  object: VideoTorrentObject | VideoChannelObject
}

export interface ActivityUpdate extends BaseActivity {
  type: 'Update'
  object: VideoTorrentObject | VideoChannelObject
}

export interface ActivityFlag extends BaseActivity {
  type: 'Flag'
  object: string
}
