import { UserNotificationSettingValue, UserNotificationType } from '@peertube/peertube-models'
import { t } from '@server/helpers/i18n.js'
import { logger } from '@server/helpers/logger.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserWithNotificationSetting } from '@server/types/models/index.js'
import { MChangeOwnershipFull } from '@server/types/models/video/change-ownership.js'
import { AbstractNotification } from '../common/abstract-notification.js'
import { buildChangeOwnershipNotification } from './change-ownership-utils.js'
import { AccountBlocklistModel } from '@server/models/blocklist/account-blocklist.js'

export class RequestVideoChangeOwnership extends AbstractNotification<MChangeOwnershipFull> {
  private user: MUserDefault
  private channelAccountMuted: boolean

  async prepare () {
    this.user = await UserModel.loadByAccountId(this.payload.nextOwnerAccountId)

    const hash = await AccountBlocklistModel.isAccountMutedByAccounts([ this.user.Account.id ], this.payload.initiatorAccountId)
    this.channelAccountMuted = hash[this.user.Account.id] === true
  }

  log () {
    logger.info('Notifying %s of ownership request for video %s.', this.user.username, this.payload.Video.url)
  }

  isDisabled () {
    return false
  }

  getSetting (_user: MUserWithNotificationSetting) {
    if (this.channelAccountMuted) return UserNotificationSettingValue.NONE

    return UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
  }

  getTargetUsers () {
    if (!this.user) return []

    return [ this.user ]
  }

  createNotification (user: MUserWithNotificationSetting) {
    return buildChangeOwnershipNotification({
      user,
      payload: this.payload,
      notificationType: UserNotificationType.VIDEO_OWNERSHIP_CHANGED_REQUEST
    })
  }

  createEmail (user: MUserWithNotificationSetting) {
    const language = user.getLanguage()
    const to = { email: user.email, language }

    return {
      to,
      subject: t('A video ownership change request is waiting for you', language),
      text: t('{initiator} wants to transfer ownership of {videoName} to you.', language, {
        initiator: this.payload.Initiator.getDisplayName(),
        videoName: this.payload.Video.name
      }),
      locals: {
        action: {
          text: t('Review the request', language),
          url: WEBSERVER.URL + '/my-library/ownership'
        }
      }
    }
  }
}
