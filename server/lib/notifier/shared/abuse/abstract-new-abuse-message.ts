import { WEBSERVER } from '@server/initializers/constants'
import { AccountModel } from '@server/models/account/account'
import { UserNotificationModel } from '@server/models/user/user-notification'
import { MAbuseFull, MAbuseMessage, MAccountDefault, MUserWithNotificationSetting, UserNotificationModelForApi } from '@server/types/models'
import { UserNotificationType } from '@shared/models'
import { AbstractNotification } from '../common/abstract-notification'

export type NewAbuseMessagePayload = {
  abuse: MAbuseFull
  message: MAbuseMessage
}

export abstract class AbstractNewAbuseMessage extends AbstractNotification <NewAbuseMessagePayload> {
  protected messageAccount: MAccountDefault

  async loadMessageAccount () {
    this.messageAccount = await AccountModel.load(this.message.accountId)
  }

  getSetting (user: MUserWithNotificationSetting) {
    return user.NotificationSetting.abuseNewMessage
  }

  async createNotification (user: MUserWithNotificationSetting) {
    const notification = await UserNotificationModel.create<UserNotificationModelForApi>({
      type: UserNotificationType.ABUSE_NEW_MESSAGE,
      userId: user.id,
      abuseId: this.abuse.id
    })
    notification.Abuse = this.abuse

    return notification
  }

  protected createEmailFor (to: string, target: 'moderator' | 'reporter') {
    const text = 'New message on report #' + this.abuse.id
    const abuseUrl = target === 'moderator'
      ? WEBSERVER.URL + '/admin/moderation/abuses/list?search=%23' + this.abuse.id
      : WEBSERVER.URL + '/my-account/abuses?search=%23' + this.abuse.id

    const action = {
      text,
      url: abuseUrl
    }

    return {
      template: 'abuse-new-message',
      to,
      subject: text,
      locals: {
        abuseId: this.abuse.id,
        abuseUrl: action.url,
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
