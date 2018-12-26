export enum UserNotificationType {
  NEW_VIDEO_FROM_SUBSCRIPTION = 1,
  NEW_COMMENT_ON_MY_VIDEO = 2,
  NEW_VIDEO_ABUSE_FOR_MODERATORS = 3,
  BLACKLIST_ON_MY_VIDEO = 4,
  UNBLACKLIST_ON_MY_VIDEO = 5
}

interface VideoInfo {
  id: number
  uuid: string
  name: string
}

export interface UserNotification {
  id: number
  type: UserNotificationType
  read: boolean

  video?: VideoInfo & {
    channel: {
      id: number
      displayName: string
    }
  }

  comment?: {
    id: number
    account: {
      id: number
      displayName: string
    }
  }

  videoAbuse?: {
    id: number
    video: VideoInfo
  }

  videoBlacklist?: {
    id: number
    video: VideoInfo
  }

  createdAt: string
  updatedAt: string
}
