import { UserNotificationType_Type } from '@peertube/peertube-models'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MUserId, UserNotificationModelForApi } from '@server/types/models/user/index.js'
import { MChangeOwnershipFull } from '@server/types/models/video/change-ownership.js'

export function buildVideoChangeOwnershipNotification (options: {
  user: MUserId
  payload: MChangeOwnershipFull
  notificationType: UserNotificationType_Type
}): UserNotificationModelForApi {
  const { user, payload, notificationType } = options

  const notification = UserNotificationModel.build<UserNotificationModelForApi>({
    type: notificationType,
    userId: user.id,
    changeOwnershipId: payload.id
  })

  notification.ChangeOwnership = payload

  return notification
}
