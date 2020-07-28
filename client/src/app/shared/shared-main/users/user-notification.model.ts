import {
  AbuseState,
  ActorInfo,
  FollowState,
  UserNotification as UserNotificationServer,
  UserNotificationType,
  VideoInfo,
  UserRight
} from '@shared/models'
import { Actor } from '../account/actor.model'
import { AuthUser } from '@app/core'

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

  account?: ActorInfo & { avatarUrl?: string }

  actorFollow?: {
    id: number
    state: FollowState
    follower: ActorInfo & { avatarUrl?: string }
    following: {
      type: 'account' | 'channel' | 'instance'
      name: string
      displayName: string
      host: string
    }
  }

  createdAt: string
  updatedAt: string

  // Additional fields
  videoUrl?: string
  commentUrl?: any[]
  abuseUrl?: string
  abuseQueryParams?: { [id: string]: string } = {}
  videoAutoBlacklistUrl?: string
  accountUrl?: string
  videoImportIdentifier?: string
  videoImportUrl?: string
  instanceFollowUrl?: string

  constructor (hash: UserNotificationServer, user: AuthUser) {
    this.id = hash.id
    this.type = hash.type
    this.read = hash.read

    // We assume that some fields exist
    // To prevent a notification popup crash in case of bug, wrap it inside a try/catch
    try {
      this.video = hash.video
      if (this.video) this.setAvatarUrl(this.video.channel)

      this.videoImport = hash.videoImport

      this.comment = hash.comment
      if (this.comment) this.setAvatarUrl(this.comment.account)

      this.abuse = hash.abuse

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
          if (!this.comment) break
          this.accountUrl = this.buildAccountUrl(this.comment.account)
          this.commentUrl = this.buildCommentUrl(this.comment)
          break

        case UserNotificationType.NEW_ABUSE_FOR_MODERATORS:
          this.abuseUrl = '/admin/moderation/abuses/list'
          this.abuseQueryParams.search = '#' + this.abuse.id

          if (this.abuse.video) this.videoUrl = this.buildVideoUrl(this.abuse.video)
          else if (this.abuse.comment) this.commentUrl = this.buildCommentUrl(this.abuse.comment)
          else if (this.abuse.account) this.accountUrl = this.buildAccountUrl(this.abuse.account)
          break

        case UserNotificationType.ABUSE_STATE_CHANGE:
          this.abuseUrl = '/my-account/abuses'
          this.abuseQueryParams.search = '#' + this.abuse.id
          break

        case UserNotificationType.ABUSE_NEW_MESSAGE:
          this.abuseUrl = user.hasRight(UserRight.MANAGE_ABUSES)
            ? '/admin/moderation/abuses/list'
            : '/my-account/abuses'
          this.abuseQueryParams.search = '#' + this.abuse.id
          break

        case UserNotificationType.VIDEO_AUTO_BLACKLIST_FOR_MODERATORS:
          this.videoAutoBlacklistUrl = '/admin/moderation/video-auto-blacklist/list'
          // Backward compatibility where we did not assign videoBlacklist to this type of notification before
          if (!this.videoBlacklist) this.videoBlacklist = { id: null, video: this.video }

          this.videoUrl = this.buildVideoUrl(this.videoBlacklist.video)
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

          if (this.videoImport.video) this.videoUrl = this.buildVideoUrl(this.videoImport.video)
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

        case UserNotificationType.NEW_INSTANCE_FOLLOWER:
          this.instanceFollowUrl = '/admin/follows/followers-list'
          break

        case UserNotificationType.AUTO_INSTANCE_FOLLOWING:
          this.instanceFollowUrl = '/admin/follows/following-list'
          break
      }
    } catch (err) {
      this.type = null
      console.error(err)
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

  private buildCommentUrl (comment: { video: { uuid: string }, threadId: number }) {
    return [ this.buildVideoUrl(comment.video), { threadId: comment.threadId } ]
  }

  private setAvatarUrl (actor: { avatarUrl?: string, avatar?: { url?: string, path: string } }) {
    actor.avatarUrl = Actor.GET_ACTOR_AVATAR_URL(actor)
  }
}
