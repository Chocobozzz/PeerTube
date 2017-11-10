import {
  VideoChannelObject,
  VideoTorrentObject
} from './objects'
import { ActivityPubSignature } from './activitypub-signature'

export type Activity = ActivityCreate | ActivityAdd | ActivityUpdate | ActivityFlag

// Flag -> report abuse
export type ActivityType = 'Create' | 'Add' | 'Update' | 'Flag'

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
  object: VideoChannelObject
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
