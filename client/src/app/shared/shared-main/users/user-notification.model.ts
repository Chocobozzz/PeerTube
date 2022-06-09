import { AuthUser } from '@app/core'
import { Account } from '@app/shared/shared-main/account/account.model'
import { Actor } from '@app/shared/shared-main/account/actor.model'
import { VideoChannel } from '@app/shared/shared-main/video-channel/video-channel.model'
import {
  AbuseState,
  ActorInfo,
  FollowState,
  PluginType,
  UserNotification as UserNotificationServer,
  UserNotificationType,
  UserRight,
  VideoInfo
} from '@shared/models'
import { Video } from '../video'

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

  plugin?: {
    name: string
    type: PluginType
    latestVersion: string
  }

  peertube?: {
    latestVersion: string
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

  peertubeVersionLink?: string

  pluginUrl?: string
  pluginQueryParams?: { [id: string]: string } = {}

  constructor (hash: UserNotificationServer, user: AuthUser) {
    this.id = hash.id
    this.type = hash.type
    this.read = hash.read

    // We assume that some fields exist
    // To prevent a notification popup crash in case of bug, wrap it inside a try/catch
    try {
      this.video = hash.video
      if (this.video) this.setVideoChannelAvatarUrl(this.video.channel)

      this.videoImport = hash.videoImport

      this.comment = hash.comment
      if (this.comment) this.setAccountAvatarUrl(this.comment.account)

      this.abuse = hash.abuse

      this.videoBlacklist = hash.videoBlacklist

      this.account = hash.account
      if (this.account) this.setAccountAvatarUrl(this.account)

      this.actorFollow = hash.actorFollow
      if (this.actorFollow) this.setAccountAvatarUrl(this.actorFollow.follower)

      this.plugin = hash.plugin
      this.peertube = hash.peertube

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

        case UserNotificationType.NEW_PEERTUBE_VERSION:
          this.peertubeVersionLink = 'https://joinpeertube.org/news'
          break

        case UserNotificationType.NEW_PLUGIN_VERSION:
          this.pluginUrl = `/admin/plugins/list-installed`
          this.pluginQueryParams.pluginType = this.plugin.type + ''
          break
      }
    } catch (err) {
      this.type = null
      console.error(err)
    }
  }

  private buildVideoUrl (video: { uuid: string }) {
    return Video.buildWatchUrl(video)
  }

  private buildAccountUrl (account: { name: string, host: string }) {
    return '/a/' + Actor.CREATE_BY_STRING(account.name, account.host)
  }

  private buildVideoImportUrl () {
    return '/my-library/video-imports'
  }

  private buildVideoImportIdentifier (videoImport: { targetUrl?: string, magnetUri?: string, torrentName?: string }) {
    return videoImport.targetUrl || videoImport.magnetUri || videoImport.torrentName
  }

  private buildCommentUrl (comment: { video: { uuid: string }, threadId: number }) {
    return [ this.buildVideoUrl(comment.video), { threadId: comment.threadId } ]
  }

  private setAccountAvatarUrl (actor: { avatarUrl?: string, avatar?: { url?: string, path: string } }) {
    actor.avatarUrl = Account.GET_ACTOR_AVATAR_URL(actor) || Account.GET_DEFAULT_AVATAR_URL()
  }

  private setVideoChannelAvatarUrl (actor: { avatarUrl?: string, avatar?: { url?: string, path: string } }) {
    actor.avatarUrl = VideoChannel.GET_ACTOR_AVATAR_URL(actor) || VideoChannel.GET_DEFAULT_AVATAR_URL()
  }
}
