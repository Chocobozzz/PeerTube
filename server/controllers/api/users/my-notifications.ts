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
import { getFormattedObjects } from '../../../helpers/utils'
import { UserNotificationModel } from '../../../models/account/user-notification'
import { meRouter } from './me'
import {
  listUserNotificationsValidator,
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
  listUserNotificationsValidator,
  asyncMiddleware(listUserNotifications)
)

myNotificationsRouter.post('/me/notifications/read',
  authenticate,
  markAsReadUserNotificationsValidator,
  asyncMiddleware(markAsReadUserNotifications)
)

myNotificationsRouter.post('/me/notifications/read-all',
  authenticate,
  asyncMiddleware(markAsReadAllUserNotifications)
)

export {
  myNotificationsRouter
}

// ---------------------------------------------------------------------------

async function updateNotificationSettings (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const body = req.body as UserNotificationSetting

  const query = {
    where: {
      userId: user.id
    }
  }

  const values: UserNotificationSetting = {
    newVideoFromSubscription: body.newVideoFromSubscription,
    newCommentOnMyVideo: body.newCommentOnMyVideo,
    abuseAsModerator: body.abuseAsModerator,
    videoAutoBlacklistAsModerator: body.videoAutoBlacklistAsModerator,
    blacklistOnMyVideo: body.blacklistOnMyVideo,
    myVideoPublished: body.myVideoPublished,
    myVideoImportFinished: body.myVideoImportFinished,
    newFollow: body.newFollow,
    newUserRegistration: body.newUserRegistration,
    commentMention: body.commentMention,
    newInstanceFollower: body.newInstanceFollower,
    autoInstanceFollowing: body.autoInstanceFollowing,
    abuseNewMessage: body.abuseNewMessage,
    abuseStateChange: body.abuseStateChange
  }

  await UserNotificationSettingModel.update(values, query)

  return res.status(204).end()
}

async function listUserNotifications (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User

  const resultList = await UserNotificationModel.listForApi(user.id, req.query.start, req.query.count, req.query.sort, req.query.unread)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function markAsReadUserNotifications (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User

  await UserNotificationModel.markAsRead(user.id, req.body.ids)

  return res.status(204).end()
}

async function markAsReadAllUserNotifications (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User

  await UserNotificationModel.markAllAsRead(user.id)

  return res.status(204).end()
}
