import { UserNotificationSettingValue, UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { AccountBlocklistModel } from '@server/models/account/account-blocklist.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting } from '@server/types/models/index.js'
import { AbstractNotification } from '../common/abstract-notification.js'
import { buildCollaborateToChannelNotification, NotificationCollaboratePayload } from './collaborate-to-channel-utils.js'

export class InvitedToCollaborateToChannel extends AbstractNotification<NotificationCollaboratePayload> {
  private user: MUserDefault
  private channelAccountMuted = false

  async prepare () {
    this.user = await UserModel.loadByAccountId(this.payload.collaborator.accountId)

    const hash = await AccountBlocklistModel.isAccountMutedByAccounts([ this.user.Account.id ], this.payload.channel.accountId)
    this.channelAccountMuted = hash[this.user.Account.id] === true
  }

  log () {
    logger.info(
      `Notifying user ${this.user.username} of invitation to collaborate on channel ${this.payload.channel.Actor.getIdentifier()}`
    )
  }

  isDisabled () {
    return false
  }

  getSetting (_user: MUserWithNotificationSetting) {
    if (this.channelAccountMuted) return UserNotificationSettingValue.NONE

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
      notificationType: UserNotificationType.INVITED_TO_COLLABORATE_TO_CHANNEL
    })
  }

  // ---------------------------------------------------------------------------

  createEmail (user: MUserWithNotificationSetting) {
    const userLanguage = user.getLanguage()
    const to = { email: user.email, language: userLanguage }

    const { channel } = this.payload

    const text = t('{channelOwner} invited you to become a collaborator of channel {channelName}', userLanguage, {
      channelOwner: channel.Account.getDisplayName(),
      channelName: channel.getDisplayName()
    })

    return {
      to,
      subject: text,
      text,
      locals: {
        action: {
          text: t('Review the invitation', userLanguage),
          url: WEBSERVER.URL + '/my-account/notifications'
        }
      }
    }
  }
}
