import { UserNotificationType_Type } from '@peertube/peertube-models'
import { UserNotificationModel } from '@server/models/user/user-notification.js'
import { MChannelAccountDefault, MChannelCollaboratorAccount } from '@server/types/models/index.js'
import { MUserId, UserNotificationModelForApi } from '@server/types/models/user/index.js'

export type NotificationCollaboratePayload = {
  collaborator: MChannelCollaboratorAccount
  channel: MChannelAccountDefault
}

export function buildCollaborateToChannelNotification (options: {
  user: MUserId
  payload: NotificationCollaboratePayload
  notificationType: UserNotificationType_Type
}): UserNotificationModelForApi {
  const { user, payload, notificationType } = options

  const notification = UserNotificationModel.build<UserNotificationModelForApi>({
    type: notificationType,

    userId: user.id,
    channelCollaboratorId: payload.collaborator.id
  })

  notification.VideoChannelCollaborator = Object.assign(payload.collaborator, {
    Account: payload.collaborator.Account,
    Channel: payload.channel
  })

  return notification
}
