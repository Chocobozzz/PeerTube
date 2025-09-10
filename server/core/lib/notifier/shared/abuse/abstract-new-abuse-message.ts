import { To, UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { getAdminAbuseUrl, getUserAbuseUrl } from '@server/lib/client-urls.js'
import { AccountModel } from '@server/models/account/account.js'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import {
  MAbuseFull,
  MAbuseMessage,
  MAccountDefault,
  MUserWithNotificationSetting,
  UserNotificationModelForApi
} from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'

type NewAbuseMessagePayload = {
  abuse: MAbuseFull
  message: MAbuseMessage
}

export abstract class AbstractNewAbuseMessage extends AbstractNotification<NewAbuseMessagePayload> {
  protected messageAccount: MAccountDefault

  async loadMessageAccount () {
    this.messageAccount = await AccountModel.load(this.message.accountId)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.abuseNewMessage
  }

  createNotification (user: MUserWithNotificationSetting) {
    const notification = UserNotificationModel.build<UserNotificationModelForApi>({
      type: UserNotificationType.ABUSE_NEW_MESSAGE,
      userId: user.id,
      abuseId: this.abuse.id
    })
    notification.Abuse = this.abuse

    return notification
  }

  protected createEmailFor (to: To, target: 'moderator' | 'reporter') {
    const text = t('New message on report #{id}', to.language, { id: this.abuse.id })
    const abuseUrl = target === 'moderator'
      ? getAdminAbuseUrl(this.abuse)
      : getUserAbuseUrl(this.abuse)

    const action = {
      text: t('View report #{id}', to.language, { id: this.abuse.id }),
      url: abuseUrl
    }

    return {
      template: 'abuse-new-message',
      to,
      subject: text,
      locals: {
        abuseId: this.abuse.id,
        abuseUrl,
        messageAccountName: this.messageAccount.getDisplayName(),
        messageText: this.message.message,
        action
      }
    }
  }

  protected get abuse () {
    return this.payload.abuse
  }

  protected get message () {
    return this.payload.message
  }
}
