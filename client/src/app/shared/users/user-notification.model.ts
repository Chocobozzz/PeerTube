import { UserNotification as UserNotificationServer, UserNotificationType, VideoInfo } from '../../../../../shared'

export class UserNotification implements UserNotificationServer {
  id: number
  type: UserNotificationType
  read: boolean

  video?: VideoInfo & {
    channel: {
      id: number
      displayName: string
    }
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
    account: {
      id: number
      displayName: string
    }
    video: VideoInfo
  }

  videoAbuse?: {
    id: number
    video: VideoInfo
  }

  videoBlacklist?: {
    id: number
    video: VideoInfo
  }

  account?: {
    id: number
    displayName: string
    name: string
  }

  actorFollow?: {
    id: number
    follower: {
      name: string
      displayName: string
    }
    following: {
      type: 'account' | 'channel'
      name: string
      displayName: string
    }
  }

  createdAt: string
  updatedAt: string

  // Additional fields
  videoUrl?: string
  commentUrl?: any[]
  videoAbuseUrl?: string
  accountUrl?: string
  videoImportIdentifier?: string
  videoImportUrl?: string

  constructor (hash: UserNotificationServer) {
    this.id = hash.id
    this.type = hash.type
    this.read = hash.read

    this.video = hash.video
    this.videoImport = hash.videoImport
    this.comment = hash.comment
    this.videoAbuse = hash.videoAbuse
    this.videoBlacklist = hash.videoBlacklist
    this.account = hash.account
    this.actorFollow = hash.actorFollow

    this.createdAt = hash.createdAt
    this.updatedAt = hash.updatedAt

    switch (this.type) {
      case UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION:
        this.videoUrl = this.buildVideoUrl(this.video)
        break

      case UserNotificationType.UNBLACKLIST_ON_MY_VIDEO:
        this.videoUrl = this.buildVideoUrl(this.video)
        break

      case UserNotificationType.NEW_COMMENT_ON_MY_VIDEO:
      case UserNotificationType.COMMENT_MENTION:
        this.commentUrl = [ this.buildVideoUrl(this.comment.video), { threadId: this.comment.threadId } ]
        break

      case UserNotificationType.NEW_VIDEO_ABUSE_FOR_MODERATORS:
        this.videoAbuseUrl = '/admin/moderation/video-abuses/list'
        this.videoUrl = this.buildVideoUrl(this.videoAbuse.video)
        break

      case UserNotificationType.BLACKLIST_ON_MY_VIDEO:
        this.videoUrl = this.buildVideoUrl(this.videoBlacklist.video)
        break

      case UserNotificationType.MY_VIDEO_PUBLISHED:
        this.videoUrl = this.buildVideoUrl(this.video)
        break

      case UserNotificationType.MY_VIDEO_IMPORT_SUCCESS:
        this.videoImportUrl = this.buildVideoImportUrl()
        this.videoImportIdentifier = this.buildVideoImportIdentifier(this.videoImport)
        this.videoUrl = this.buildVideoUrl(this.videoImport.video)
        break

      case UserNotificationType.MY_VIDEO_IMPORT_ERROR:
        this.videoImportUrl = this.buildVideoImportUrl()
        this.videoImportIdentifier = this.buildVideoImportIdentifier(this.videoImport)
        break

      case UserNotificationType.NEW_USER_REGISTRATION:
        this.accountUrl = this.buildAccountUrl(this.account)
        break

      case UserNotificationType.NEW_FOLLOW:
        this.accountUrl = this.buildAccountUrl(this.actorFollow.follower)
        break
    }
  }

  private buildVideoUrl (video: { uuid: string }) {
    return '/videos/watch/' + video.uuid
  }

  private buildAccountUrl (account: { name: string }) {
    return '/accounts/' + account.name
  }

  private buildVideoImportUrl () {
    return '/my-account/video-imports'
  }

  private buildVideoImportIdentifier (videoImport: { targetUrl?: string, magnetUri?: string, torrentName?: string }) {
    return videoImport.targetUrl || videoImport.magnetUri || videoImport.torrentName
  }

}
