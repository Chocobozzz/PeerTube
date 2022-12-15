import { logger } from '@server/helpers/logger'
import { WEBSERVER } from '@server/initializers/constants'
import { getAbuseTargetUrl } from '@server/lib/activitypub/url'
import { UserModel } from '@server/models/user/user'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MAbuseFull, MUserDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models'
import { AbuseState, UserNotificationType } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export class AbuseStateChangeForReporter extends AbstractNotification <MAbuseFull> {

  private user: MUserDefault

  async prepare () {
    const reporter = this.abuse.ReporterAccount
    if (reporter.isOwned() !== true) return

    this.user = await UserModel.loadByAccountActorId(this.abuse.ReporterAccount.actorId)
  }

  log () {
    logger.info('Notifying reporter of abuse % of state change.', getAbuseTargetUrl(this.abuse))
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

  createEmail (to: string) {
    const text = this.abuse.state === AbuseState.ACCEPTED
      ? 'Report #' + this.abuse.id + ' has been accepted'
      : 'Report #' + this.abuse.id + ' has been rejected'

    const abuseUrl = WEBSERVER.URL + '/my-account/abuses?search=%23' + this.abuse.id

    const action = {
      text: 'View report #' + this.abuse.id,
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
