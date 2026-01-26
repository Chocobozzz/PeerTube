import { AbuseState, UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { getAbuseIdentifier } from '@server/lib/activitypub/url.js'
import { getUserAbuseUrl } from '@server/lib/client-urls.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { UserModel } from '@server/models/user/user.js'
import { MAbuseFull, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

export class AbuseStateChangeForReporter extends AbstractNotification<MAbuseFull> {
  private user: MUserDefault

  async prepare () {
    const reporter = this.abuse.ReporterAccount
    if (reporter.isLocal() !== true) return

    this.user = await UserModel.loadByAccountActorId(this.abuse.ReporterAccount.Actor.id)
  }

  log () {
    logger.info('Notifying reporter of abuse % of state change.', getAbuseIdentifier(this.abuse))
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.abuseStateChange
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.ABUSE_STATE_CHANGE,
      userId: user.id,
      abuseId: this.abuse.id
    })
    notification.Abuse = this.abuse

    return notification
  }

  createEmail (user: MUserWithNotificationSetting) {
    const language = user.getLanguage()
    const to = { email: user.email, language }

    const text = this.abuse.state === AbuseState.ACCEPTED
      ? t('Report #{id} has been accepted', language, { id: this.abuse.id })
      : t('Report #{id} has been rejected', language, { id: this.abuse.id })

    const abuseUrl = getUserAbuseUrl(this.abuse)

    const action = {
      text: t('View report #{id}', language, { id: this.abuse.id }),
      url: abuseUrl
    }

    return {
      template: 'abuse-state-change',
      to,
      subject: text,
      locals: {
        action,
        abuseId: this.abuse.id,
        abuseUrl,
        isAccepted: this.abuse.state === AbuseState.ACCEPTED
      }
    }
  }

  private get abuse () {
    return this.payload
  }
}
