import { UserNotificationType_Type } from '@peertube/peertube-models'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MUserId, UserNotificationModelForApi } from '@server/types/models/user/index.js'
import { MVideoChangeOwnershipFull } from '@server/types/models/video/video-change-ownership.js'

export function buildVideoOwnershipNotification (options: {
  user: MUserId
  payload: MVideoChangeOwnershipFull
  notificationType: UserNotificationType_Type
}): UserNotificationModelForApi {
  const { user, payload, notificationType } = options

  const notification = UserNotificationModel.build<UserNotificationModelForApi>({
    type: notificationType,
    userId: user.id,
    videoOwnershipId: payload.id
  })

  notification.VideoOwnership = payload

  return notification
}
