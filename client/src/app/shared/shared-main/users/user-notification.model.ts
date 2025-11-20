import { AuthUser } from '@app/core'
import { Actor } from '@app/shared/shared-main/account/actor.model'
import {
  UserNotification as UserNotificationServer,
  UserNotificationType,
  UserRight,
  VideoChannelCollaboratorState
} from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { Video } from '../video/video.model'

export class UserNotification {
  payload: UserNotificationServer

  // Default notification URL
  url: string | any[]
  queryParams?: { [id: string]: string } = {}

  externalUrl: string

  videoImportIdentifier: string
  followingHandle: string
  followerHandle: string

  constructor (payload: UserNotificationServer, user: AuthUser) {
    this.payload = payload

    // We assume that some fields exist
    // To prevent a notification popup crash in case of bug, wrap it inside a try/catch
    try {
      switch (payload.type) {
        case UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION:
        case UserNotificationType.NEW_LIVE_FROM_SUBSCRIPTION:
          this.url = this.buildVideoUrl(payload.video)
          break

        case UserNotificationType.BLACKLIST_ON_MY_VIDEO:
          this.url = this.buildVideoUrl(payload.videoBlacklist.video)
          break

        case UserNotificationType.UNBLACKLIST_ON_MY_VIDEO:
          this.url = this.buildVideoUrl(payload.video)
          break

        case UserNotificationType.NEW_COMMENT_ON_MY_VIDEO:
        case UserNotificationType.COMMENT_MENTION:
          if (!payload.comment) break

          if (payload.comment.heldForReview) {
            this.url = '/my-account/videos/comments'
            this.queryParams.search = 'heldForReview:true'
          } else {
            this.url = this.buildCommentUrl(payload.comment)
          }

          break

        case UserNotificationType.NEW_ABUSE_FOR_MODERATORS:
          this.url = '/admin/moderation/abuses/list'
          this.queryParams.search = '#' + payload.abuse.id
          break

        case UserNotificationType.ABUSE_STATE_CHANGE:
          this.url = '/my-account/abuses'
          this.queryParams.search = '#' + payload.abuse.id
          break

        case UserNotificationType.ABUSE_NEW_MESSAGE:
          this.url = user.hasRight(UserRight.MANAGE_ABUSES)
            ? '/admin/moderation/abuses/list'
            : '/my-account/abuses'
          this.queryParams.search = '#' + payload.abuse.id
          break

        case UserNotificationType.VIDEO_AUTO_BLACKLIST_FOR_MODERATORS:
          // Backward compatibility where we did not assign videoBlacklist to this type of notification before
          if (!this.payload.videoBlacklist) this.payload.videoBlacklist = { id: null, video: payload.video }

          this.url = '/admin/moderation/video-auto-blacklist/list'
          break

        case UserNotificationType.MY_VIDEO_PUBLISHED:
          this.url = this.buildVideoUrl(payload.video)
          break

        case UserNotificationType.MY_VIDEO_IMPORT_SUCCESS:
          this.videoImportIdentifier = this.buildVideoImportIdentifier(payload.videoImport)
          this.url = payload.video
            ? this.buildVideoUrl(payload.video)
            : this.buildVideoImportUrl()
          break

        case UserNotificationType.MY_VIDEO_IMPORT_ERROR:
          this.videoImportIdentifier = this.buildVideoImportIdentifier(payload.videoImport)
          this.url = this.buildVideoImportUrl()
          break

        case UserNotificationType.NEW_USER_REGISTRATION:
          this.url = this.buildAccountUrl(payload.account)
          break

        case UserNotificationType.NEW_USER_REGISTRATION_REQUEST:
          this.url = '/admin/moderation/registrations/list'
          break

        case UserNotificationType.NEW_FOLLOW:
          this.url = this.buildAccountUrl(payload.actorFollow.follower)
          break

        case UserNotificationType.NEW_INSTANCE_FOLLOWER: {
          const follower = payload.actorFollow.follower
          this.followerHandle = follower.name === 'peertube'
            ? follower.host
            : `${follower.name} @ ${follower.host}`

          this.url = '/admin/settings/follows/followers-list'
          break
        }

        case UserNotificationType.AUTO_INSTANCE_FOLLOWING: {
          const following = payload.actorFollow.following

          this.followingHandle = following.name === 'peertube'
            ? following.host
            : `${following.name} @ ${following.host}`

          this.url = '/admin/settings/follows/following-list'

          break
        }

        case UserNotificationType.NEW_PEERTUBE_VERSION:
          this.externalUrl = 'https://joinpeertube.org/news'
          break

        case UserNotificationType.NEW_PLUGIN_VERSION:
          this.url = `/admin/settings/plugins/list-installed`
          this.queryParams.pluginType = payload.plugin.type + ''
          break

        case UserNotificationType.MY_VIDEO_TRANSCRIPTION_GENERATED:
          this.url = this.buildVideoUrl(payload.videoCaption.video)
          break

        case UserNotificationType.MY_VIDEO_STUDIO_EDITION_FINISHED:
          this.url = this.buildVideoUrl(payload.video)
          break

        case UserNotificationType.INVITED_TO_COLLABORATE_TO_CHANNEL:
          if (payload.videoChannelCollaborator.state.id === VideoChannelCollaboratorState.ACCEPTED) {
            this.url = this.buildChannelUrl(payload.videoChannelCollaborator.channel)
          } // Else, no URL: we have buttons instead to accept/decline the invitation

          break

        case UserNotificationType.ACCEPTED_TO_COLLABORATE_TO_CHANNEL:
        case UserNotificationType.REFUSED_TO_COLLABORATE_TO_CHANNEL:
          this.url = this.buildChannelUrl(payload.videoChannelCollaborator.channel)
          break
      }
    } catch (err) {
      this.payload.type = null
      logger.error(err)
    }
  }

  buildVideoUrl (video: { uuid: string }) {
    return Video.buildWatchUrl(video)
  }

  buildAccountUrl (account: { name: string, host: string }) {
    return '/a/' + Actor.CREATE_BY_STRING(account.name, account.host)
  }

  buildVideoImportUrl () {
    return '/my-library/video-imports'
  }

  buildVideoImportIdentifier (videoImport: UserNotificationServer['videoImport']) {
    return videoImport.video?.name || videoImport.targetUrl || videoImport.magnetUri || videoImport.torrentName
  }

  buildCommentUrl (comment: { video: { uuid: string }, threadId: number }) {
    return [ this.buildVideoUrl(comment.video), { threadId: comment.threadId } ]
  }

  buildChannelUrl (channel: { name: string }) {
    return [ '/my-library', 'video-channels', 'manage', channel.name ]
  }
}
