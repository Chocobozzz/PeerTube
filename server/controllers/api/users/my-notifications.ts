import * as express from 'express'
import 'multer'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  userNotificationsSortValidator
} from '../../../middlewares'
import { UserModel } from '../../../models/account/user'
import { getFormattedObjects } from '../../../helpers/utils'
import { UserNotificationModel } from '../../../models/account/user-notification'
import { meRouter } from './me'
import {
  markAsReadUserNotificationsValidator,
  updateNotificationSettingsValidator
} from '../../../middlewares/validators/user-notifications'
import { UserNotificationSetting } from '../../../../shared/models/users'
import { UserNotificationSettingModel } from '../../../models/account/user-notification-setting'

const myNotificationsRouter = express.Router()

meRouter.put('/me/notification-settings',
  authenticate,
  updateNotificationSettingsValidator,
  asyncRetryTransactionMiddleware(updateNotificationSettings)
)

myNotificationsRouter.get('/me/notifications',
  authenticate,
  paginationValidator,
  userNotificationsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listUserNotifications)
)

myNotificationsRouter.post('/me/notifications/read',
  authenticate,
  markAsReadUserNotificationsValidator,
  asyncMiddleware(markAsReadUserNotifications)
)

export {
  myNotificationsRouter
}

// ---------------------------------------------------------------------------

async function updateNotificationSettings (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.oauth.token.User
  const body: UserNotificationSetting = req.body

  const query = {
    where: {
      userId: user.id
    }
  }

  await UserNotificationSettingModel.update({
    newVideoFromSubscription: body.newVideoFromSubscription,
    newCommentOnMyVideo: body.newCommentOnMyVideo
  }, query)

  return res.status(204).end()
}

async function listUserNotifications (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.oauth.token.User

  const resultList = await UserNotificationModel.listForApi(user.id, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function markAsReadUserNotifications (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.oauth.token.User

  await UserNotificationModel.markAsRead(user.id, req.body.ids)

  return res.status(204).end()
}
