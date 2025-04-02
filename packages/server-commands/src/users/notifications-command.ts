import { HttpStatusCode, ResultList, UserNotification, UserNotificationSetting, UserNotificationType_Type } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class NotificationsCommand extends AbstractCommand {

  updateMySettings (options: OverrideCommandOptions & {
    settings: UserNotificationSetting
  }) {
    const path = '/api/v1/users/me/notification-settings'

    return this.putBodyRequest({
      ...options,

      path,
      fields: options.settings,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  list (options: OverrideCommandOptions & {
    start?: number
    count?: number
    unread?: boolean
    sort?: string
    typeOneOf?: UserNotificationType_Type[]
  }) {
    const { start, count, unread, typeOneOf, sort = '-createdAt' } = options
    const path = '/api/v1/users/me/notifications'

    return this.getRequestBody<ResultList<UserNotification>>({
      ...options,

      path,
      query: {
        start,
        count,
        sort,
        typeOneOf,
        unread
      },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  markAsRead (options: OverrideCommandOptions & {
    ids: number[]
  }) {
    const { ids } = options
    const path = '/api/v1/users/me/notifications/read'

    return this.postBodyRequest({
      ...options,

      path,
      fields: { ids },
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  markAsReadAll (options: OverrideCommandOptions) {
    const path = '/api/v1/users/me/notifications/read-all'

    return this.postBodyRequest({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  async getLatest (options: OverrideCommandOptions = {}) {
    const { total, data } = await this.list({
      ...options,
      start: 0,
      count: 1,
      sort: '-createdAt'
    })

    if (total === 0) return undefined

    return data[0]
  }
}
