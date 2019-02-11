import { UserNotification as UserNotificationServer, UserNotificationType, VideoInfo, ActorInfo } from '../../../../../shared'
import { Actor } from '@app/shared/actor/actor.model'

export class UserNotification implements UserNotificationServer {
  id: number
  type: UserNotificationType
  read: boolean

  video?: VideoInfo & {
    channel: ActorInfo & { avatarUrl?: string }
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
    account: ActorInfo & { avatarUrl?: string }
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

  account?: ActorInfo & { avatarUrl?: string }

  actorFollow?: {
    id: number
    follower: ActorInfo & { avatarUrl?: string }
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
    if (this.video) this.setAvatarUrl(this.video.channel)

    this.videoImport = hash.videoImport

    this.comment = hash.comment
    if (this.comment) this.setAvatarUrl(this.comment.account)

    this.videoAbuse = hash.videoAbuse

    this.videoBlacklist = hash.videoBlacklist

    this.account = hash.account
    if (this.account) this.setAvatarUrl(this.account)

    this.actorFollow = hash.actorFollow
    if (this.actorFollow) this.setAvatarUrl(this.actorFollow.follower)

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
        this.accountUrl = this.buildAccountUrl(this.comment.account)
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

  private buildAccountUrl (account: { name: string, host: string }) {
    return '/accounts/' + Actor.CREATE_BY_STRING(account.name, account.host)
  }

  private buildVideoImportUrl () {
    return '/my-account/video-imports'
  }

  private buildVideoImportIdentifier (videoImport: { targetUrl?: string, magnetUri?: string, torrentName?: string }) {
    return videoImport.targetUrl || videoImport.magnetUri || videoImport.torrentName
  }

  private setAvatarUrl (actor: { avatarUrl?: string, avatar?: { path: string } }) {
    actor.avatarUrl = Actor.GET_ACTOR_AVATAR_URL(actor)
  }
}
