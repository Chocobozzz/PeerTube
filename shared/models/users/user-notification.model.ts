import { FollowState } from '../actors'
import { AbuseState } from '../moderation'

export enum UserNotificationType {
  NEW_VIDEO_FROM_SUBSCRIPTION = 1,
  NEW_COMMENT_ON_MY_VIDEO = 2,
  NEW_ABUSE_FOR_MODERATORS = 3,

  BLACKLIST_ON_MY_VIDEO = 4,
  UNBLACKLIST_ON_MY_VIDEO = 5,

  MY_VIDEO_PUBLISHED = 6,

  MY_VIDEO_IMPORT_SUCCESS = 7,
  MY_VIDEO_IMPORT_ERROR = 8,

  NEW_USER_REGISTRATION = 9,
  NEW_FOLLOW = 10,
  COMMENT_MENTION = 11,

  VIDEO_AUTO_BLACKLIST_FOR_MODERATORS = 12,

  NEW_INSTANCE_FOLLOWER = 13,

  AUTO_INSTANCE_FOLLOWING = 14,

  ABUSE_STATE_CHANGE = 15,

  ABUSE_NEW_MESSAGE = 16
}

export interface VideoInfo {
  id: number
  uuid: string
  name: string
}

export interface ActorInfo {
  id: number
  displayName: string
  name: string
  host: string
  avatar?: {
    path: string
  }
}

export interface UserNotification {
  id: number
  type: UserNotificationType
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
  }

  abuse?: {
    id: number
    state: AbuseState

    video?: VideoInfo

    comment?: {
      threadId: number

      video: {
        id: number
        uuid: string
        name: string
      }
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

  createdAt: string
  updatedAt: string
}
