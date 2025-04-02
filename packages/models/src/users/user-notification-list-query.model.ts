import { UserNotificationType_Type } from './user-notification.model.js'

export type UserNotificationListQuery = {
  start?: number
  count?: number
  sort?: string

  unread?: boolean

  typeOneOf?: UserNotificationType_Type[]
}
