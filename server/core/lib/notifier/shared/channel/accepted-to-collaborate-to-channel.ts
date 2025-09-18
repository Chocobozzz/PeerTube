import { UserNotificationSettingValue, UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'
import { buildCollaborateToChannelNotification, NotificationCollaboratePayload } from './collaborate-to-channel-utils.js'

export class AcceptedToCollaborateToChannel extends AbstractNotification<NotificationCollaboratePayload> {
  private user: MUserDefault

  async prepare () {
    this.user = await UserModel.loadByAccountId(this.payload.channel.accountId)
  }

  log () {
    logger.info(
      `Notifying user ${this.user.username} of accepted invitation to collaborate on channel ${this.payload.channel.Actor.getIdentifier()}`
    )
  }

  isDisabled () {
    return false
  }

  getSetting (_user: MUserWithNotificationSetting) {
    // Always notify
    return UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
  }

  getTargetUsers () {
    return [ this.user ]
  }

  createNotification (user: MUserWithNotificationSetting) {
    return buildCollaborateToChannelNotification({
      user,
      payload: this.payload,
      notificationType: UserNotificationType.ACCEPTED_TO_COLLABORATE_TO_CHANNEL
    })
  }

  // ---------------------------------------------------------------------------

  createEmail (user: MUserWithNotificationSetting) {
    const userLanguage = user.getLanguage()
    const to = { email: user.email, language: userLanguage }

    const collaborator = this.payload.collaborator

    const text = t('{collaboratorName} accepted your invitation to become a collaborator of {channelName}', userLanguage, {
      collaboratorName: collaborator.Account.getDisplayName(),
      channelName: collaborator.Channel.getDisplayName()
    })

    return {
      to,
      subject: text,
      text,
      locals: {
        action: {
          text: t('Manage your channel', userLanguage),
          url: collaborator.Channel.getClientManageUrl()
        }
      }
    }
  }
}
