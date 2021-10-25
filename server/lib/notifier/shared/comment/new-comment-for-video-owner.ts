import { logger } from '@server/helpers/logger'
import { toSafeHtml } from '@server/helpers/markdown'
import { WEBSERVER } from '@server/initializers/constants'
import { isBlockedByServerOrAccount } from '@server/lib/blocklist'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MCommentOwnerVideo, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models'
import { UserNotificationType } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export class NewCommentForVideoOwner extends AbstractNotification <MCommentOwnerVideo> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByVideoId(this.payload.videoId)
  }

  log () {
    logger.info('Notifying owner of a video %s of new comment %s.', this.user.username, this.payload.url)
  }

  isDisabled () {
    if (this.payload.Video.isOwned() === false) return true

    // Not our user or user comments its own video
    if (!this.user || this.payload.Account.userId === this.user.id) return true

    return isBlockedByServerOrAccount(this.payload.Account, this.user.Account)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.newCommentOnMyVideo
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  async createNotification (user: MUserWithNotificationSetting) {
    const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_COMMENT_ON_MY_VIDEO,
      userId: user.id,
      commentId: this.payload.id
    })
    notification.Comment = this.payload

    return notification
  }

  createEmail (to: string) {
    const video = this.payload.Video
    const videoUrl = WEBSERVER.URL + this.payload.Video.getWatchStaticPath()
    const commentUrl = WEBSERVER.URL + this.payload.getCommentStaticPath()
    const commentHtml = toSafeHtml(this.payload.text)

    return {
      template: 'video-comment-new',
      to,
      subject: 'New comment on your video ' + video.name,
      locals: {
        accountName: this.payload.Account.getDisplayName(),
        accountUrl: this.payload.Account.Actor.url,
        comment: this.payload,
        commentHtml,
        video,
        videoUrl,
        action: {
          text: 'View comment',
          url: commentUrl
        }
      }
    }
  }
}
