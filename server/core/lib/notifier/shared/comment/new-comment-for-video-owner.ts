import { logger } from '@server/helpers/logger.js'
import { toSafeHtml } from '@server/helpers/markdown.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { isBlockedByServerOrAccount } from '@server/lib/blocklist.js'
import { UserModel } from '@server/models/user/user.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MCommentOwnerVideo, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { UserNotificationType } from '@peertube/peertube-models'
import { AbstractNotification } from '../common/abstract-notification.js'

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

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_COMMENT_ON_MY_VIDEO,
      userId: user.id,
      commentId: this.payload.id
    })
    notification.VideoComment = this.payload

    return notification
  }

  createEmail (to: string) {
    const comment = this.payload

    const video = comment.Video
    const videoUrl = WEBSERVER.URL + comment.Video.getWatchStaticPath()
    const commentHtml = toSafeHtml(comment.text)

    const commentUrl = comment.heldForReview
      ? WEBSERVER.URL + comment.getCommentUserReviewPath()
      : WEBSERVER.URL + comment.getCommentStaticPath()

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
        requiresApproval: this.payload.heldForReview,
        action: {
          text: comment.heldForReview
            ? 'Review comment'
            : 'View comment',
          url: commentUrl
        }
      }
    }
  }
}
