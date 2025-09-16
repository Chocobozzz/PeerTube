import { To, UserAbuse, UserNotificationType, UserRight } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { getAbuseIdentifier } from '@server/lib/activitypub/url.js'
import { getAdminAbuseUrl } from '@server/lib/client-urls.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MAbuseFull, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export type NewAbusePayload = { abuse: Pick<UserAbuse, 'reason' | 'video'>, abuseInstance: MAbuseFull, reporter: string }

export class NewAbuseForModerators extends AbstractNotification<NewAbusePayload> {
  private moderators: MUserDefault[]

  async prepare () {
    this.moderators = await UserModel.listWithRight(UserRight.MANAGE_ABUSES)
  }

  log () {
    logger.info('Notifying %s user/moderators of new abuse %s.', this.moderators.length, getAbuseIdentifier(this.payload.abuseInstance))
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.abuseAsModerator
  }

  getTargetUsers () {
    return this.moderators
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.NEW_ABUSE_FOR_MODERATORS,
      userId: user.id,
      abuseId: this.payload.abuseInstance.id
    })
    notification.Abuse = this.payload.abuseInstance

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const to = { email: user.email, language: user.getLanguage() }

    const abuseInstance = this.payload.abuseInstance

    if (abuseInstance.VideoAbuse) return this.createVideoAbuseEmail(to)
    if (abuseInstance.VideoCommentAbuse) return this.createCommentAbuseEmail(to)

    return this.createAccountAbuseEmail(to)
  }

  private createVideoAbuseEmail (to: To) {
    const video = this.payload.abuseInstance.VideoAbuse.Video
    const channel = video.VideoChannel

    return {
      template: 'video-abuse-new',
      to,
      subject: t('New video abuse report from {reporter}', to.language, { reporter: this.payload.reporter }),
      locals: {
        videoUrl: WEBSERVER.URL + video.getWatchStaticPath(),
        isLocal: video.remote === false,
        videoCreatedAt: new Date(video.createdAt).toLocaleString(),
        videoPublishedAt: new Date(video.publishedAt).toLocaleString(),
        videoName: video.name,
        reason: this.payload.abuse.reason,
        channelDisplayName: channel.getDisplayName(),
        channelUrl: channel.getClientUrl(),
        reporter: this.payload.reporter,
        action: this.buildEmailAction(to)
      }
    }
  }

  private createCommentAbuseEmail (to: To) {
    const comment = this.payload.abuseInstance.VideoCommentAbuse.VideoComment

    return {
      template: 'video-comment-abuse-new',
      to,
      subject: t('New comment abuse report from {reporter}', to.language, { reporter: this.payload.reporter }),
      locals: {
        commentUrl: WEBSERVER.URL + comment.getCommentStaticPath(),
        videoName: comment.Video.name,
        isLocal: comment.isLocal(),
        commentCreatedAt: new Date(comment.createdAt).toLocaleString(),
        reason: this.payload.abuse.reason,
        flaggedAccount: this.payload.abuseInstance.FlaggedAccount.getDisplayName(),
        reporter: this.payload.reporter,
        action: this.buildEmailAction(to)
      }
    }
  }

  private createAccountAbuseEmail (to: To) {
    const account = this.payload.abuseInstance.FlaggedAccount
    const accountUrl = account.getClientUrl()

    return {
      template: 'account-abuse-new',
      to,
      subject: t('New account abuse report from {reporter}', to.language, { reporter: this.payload.reporter }),
      locals: {
        accountUrl,
        accountDisplayName: account.getDisplayName(),
        isLocal: account.isLocal(),
        reason: this.payload.abuse.reason,
        reporter: this.payload.reporter,
        action: this.buildEmailAction(to)
      }
    }
  }

  private buildEmailAction (to: To) {
    return {
      text: t('View report #' + this.payload.abuseInstance.id, to.language),
      url: getAdminAbuseUrl(this.payload.abuseInstance)
    }
  }
}
