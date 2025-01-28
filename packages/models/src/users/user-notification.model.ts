import { FollowState } from '../actors/index.js'
import { AbuseStateType } from '../moderation/index.js'
import { PluginType_Type } from '../plugins/index.js'
import { VideoConstant } from '../videos/video-constant.model.js'
import { VideoStateType } from '../videos/video-state.enum.js'

export const UserNotificationType = {
  NEW_VIDEO_FROM_SUBSCRIPTION: 1,
  NEW_COMMENT_ON_MY_VIDEO: 2,
  NEW_ABUSE_FOR_MODERATORS: 3,

  BLACKLIST_ON_MY_VIDEO: 4,
  UNBLACKLIST_ON_MY_VIDEO: 5,

  MY_VIDEO_PUBLISHED: 6,

  MY_VIDEO_IMPORT_SUCCESS: 7,
  MY_VIDEO_IMPORT_ERROR: 8,

  NEW_USER_REGISTRATION: 9,
  NEW_FOLLOW: 10,
  COMMENT_MENTION: 11,

  VIDEO_AUTO_BLACKLIST_FOR_MODERATORS: 12,

  NEW_INSTANCE_FOLLOWER: 13,

  AUTO_INSTANCE_FOLLOWING: 14,

  ABUSE_STATE_CHANGE: 15,

  ABUSE_NEW_MESSAGE: 16,

  NEW_PLUGIN_VERSION: 17,
  NEW_PEERTUBE_VERSION: 18,

  MY_VIDEO_STUDIO_EDITION_FINISHED: 19,

  NEW_USER_REGISTRATION_REQUEST: 20,

  NEW_LIVE_FROM_SUBSCRIPTION: 21,

  MY_VIDEO_TRANSCRIPTION_GENERATED: 22
} as const

export type UserNotificationType_Type = typeof UserNotificationType[keyof typeof UserNotificationType]

export interface VideoInfo {
  id: number
  uuid: string
  shortUUID: string
  name: string
  state: {
    id: VideoStateType
    label: string
  }
}

export interface AvatarInfo {
  width: number
  path: string
}

export interface ActorInfo {
  id: number
  displayName: string
  name: string
  host: string

  avatars: AvatarInfo[]
  avatar: AvatarInfo
}

export interface UserNotification {
  id: number
  type: UserNotificationType_Type
  read: boolean

  video?: VideoInfo & {
    channel: ActorInfo
  }

  videoImport?: {
    id: number
    video?: VideoInfo
    torrentName?: string
    magnetUri?: string
    targetUrl?: string
  }

  comment?: {
    id: number
    threadId: number
    account: ActorInfo
    video: VideoInfo
    heldForReview: boolean
  }

  abuse?: {
    id: number
    state: AbuseStateType

    video?: VideoInfo

    comment?: {
      threadId: number

      video: VideoInfo
    }

    account?: ActorInfo
  }

  videoBlacklist?: {
    id: number
    video: VideoInfo
  }

  account?: ActorInfo

  actorFollow?: {
    id: number
    follower: ActorInfo
    state: FollowState

    following: {
      type: 'account' | 'channel' | 'instance'
      name: string
      displayName: string
      host: string
    }
  }

  plugin?: {
    name: string
    type: PluginType_Type
    latestVersion: string
  }

  peertube?: {
    latestVersion: string
  }

  registration?: {
    id: number
    username: string
  }

  videoCaption?: {
    id: number
    language: VideoConstant<string>
    video: VideoInfo
  }

  createdAt: string
  updatedAt: string
}
