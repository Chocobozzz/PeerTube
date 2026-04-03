import { UserNotificationSettingValue, UserNotificationType_Type } from '@peertube/peertube-models'
import { UserModel } from '@server/models/user/user.js'
import { MUserWithNotificationSetting } from '@server/types/models/index.js'
import { MChangeOwnershipFull } from '@server/types/models/video/change-ownership.js'
import { AbstractNotification } from '../common/abstract-notification.js'
import { buildVideoChangeOwnershipNotification } from './video-change-ownership-utils.js'

export abstract class AbstractVideoChangeOwnershipResponse extends AbstractNotification<MChangeOwnershipFull> {
  protected users: MUserWithNotificationSetting[] = []

  async prepare () {
    this.users = await UserModel.listOwnerAndAcceptedCollaboratorsOfChannel(this.payload.Video.channelId)
  }

  isDisabled () {
    return false
  }

  getSetting (_user: MUserWithNotificationSetting) {
    return UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL
  }

  getTargetUsers () {
    return this.users.filter(user => user.id !== this.payload.NextOwner.userId)
  }

  createNotification (user: MUserWithNotificationSetting) {
    return buildVideoChangeOwnershipNotification({
      user,
      payload: this.payload,
      notificationType: this.getNotificationType()
    })
  }

  protected abstract getNotificationType (): UserNotificationType_Type
}
