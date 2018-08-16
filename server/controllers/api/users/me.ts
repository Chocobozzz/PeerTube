import * as express from 'express'
import 'multer'
import { UserUpdateMe, UserVideoRate as FormattedUserVideoRate } from '../../../../shared'
import { getFormattedObjects } from '../../../helpers/utils'
import { CONFIG, IMAGE_MIMETYPE_EXT, sequelizeTypescript } from '../../../initializers'
import { sendUpdateActor } from '../../../lib/activitypub/send'
import {
  asyncMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  usersUpdateMeValidator,
  usersVideoRatingValidator
} from '../../../middlewares'
import { deleteMeValidator, videoImportsSortValidator, videosSortValidator } from '../../../middlewares/validators'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { UserModel } from '../../../models/account/user'
import { VideoModel } from '../../../models/video/video'
import { VideoSortField } from '../../../../client/src/app/shared/video/sort-field.type'
import { createReqFiles } from '../../../helpers/express-utils'
import { UserVideoQuota } from '../../../../shared/models/users/user-video-quota.model'
import { updateAvatarValidator } from '../../../middlewares/validators/avatar'
import { updateActorAvatarFile } from '../../../lib/avatar'
import { auditLoggerFactory, UserAuditView } from '../../../helpers/audit-logger'
import { VideoImportModel } from '../../../models/video/video-import'

const auditLogger = auditLoggerFactory('users-me')

const reqAvatarFile = createReqFiles([ 'avatarfile' ], IMAGE_MIMETYPE_EXT, { avatarfile: CONFIG.STORAGE.AVATARS_DIR })

const meRouter = express.Router()

meRouter.get('/me',
  authenticate,
  asyncMiddleware(getUserInformation)
)
meRouter.delete('/me',
  authenticate,
  asyncMiddleware(deleteMeValidator),
  asyncMiddleware(deleteMe)
)

meRouter.get('/me/video-quota-used',
  authenticate,
  asyncMiddleware(getUserVideoQuotaUsed)
)

meRouter.get('/me/videos/imports',
  authenticate,
  paginationValidator,
  videoImportsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(getUserVideoImports)
)

meRouter.get('/me/videos',
  authenticate,
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(getUserVideos)
)

meRouter.get('/me/videos/:videoId/rating',
  authenticate,
  asyncMiddleware(usersVideoRatingValidator),
  asyncMiddleware(getUserVideoRating)
)

meRouter.put('/me',
  authenticate,
  usersUpdateMeValidator,
  asyncMiddleware(updateMe)
)

meRouter.post('/me/avatar/pick',
  authenticate,
  reqAvatarFile,
  updateAvatarValidator,
  asyncMiddleware(updateMyAvatar)
)

// ---------------------------------------------------------------------------

export {
  meRouter
}

// ---------------------------------------------------------------------------

async function getUserVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.User as UserModel
  const resultList = await VideoModel.listUserVideosForApi(
    user.Account.id,
    req.query.start as number,
    req.query.count as number,
    req.query.sort as VideoSortField
  )

  const additionalAttributes = {
    waitTranscoding: true,
    state: true,
    scheduledUpdate: true,
    blacklistInfo: true
  }
  return res.json(getFormattedObjects(resultList.data, resultList.total, { additionalAttributes }))
}

async function getUserVideoImports (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.User as UserModel
  const resultList = await VideoImportModel.listUserVideoImportsForApi(
    user.id,
    req.query.start as number,
    req.query.count as number,
    req.query.sort
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function getUserInformation (req: express.Request, res: express.Response, next: express.NextFunction) {
  // We did not load channels in res.locals.user
  const user = await UserModel.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username)

  return res.json(user.toFormattedJSON())
}

async function getUserVideoQuotaUsed (req: express.Request, res: express.Response, next: express.NextFunction) {
  // We did not load channels in res.locals.user
  const user = await UserModel.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username)
  const videoQuotaUsed = await UserModel.getOriginalVideoFileTotalFromUser(user)

  const data: UserVideoQuota = {
    videoQuotaUsed
  }
  return res.json(data)
}

async function getUserVideoRating (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoId = +req.params.videoId
  const accountId = +res.locals.oauth.token.User.Account.id

  const ratingObj = await AccountVideoRateModel.load(accountId, videoId, null)
  const rating = ratingObj ? ratingObj.type : 'none'

  const json: FormattedUserVideoRate = {
    videoId,
    rating
  }
  res.json(json)
}

async function deleteMe (req: express.Request, res: express.Response) {
  const user: UserModel = res.locals.oauth.token.User

  await user.destroy()

  auditLogger.delete(res.locals.oauth.token.User.Account.Actor.getIdentifier(), new UserAuditView(user.toFormattedJSON()))

  return res.sendStatus(204)
}

async function updateMe (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserUpdateMe = req.body

  const user: UserModel = res.locals.oauth.token.user
  const oldUserAuditView = new UserAuditView(user.toFormattedJSON())

  if (body.password !== undefined) user.password = body.password
  if (body.email !== undefined) user.email = body.email
  if (body.nsfwPolicy !== undefined) user.nsfwPolicy = body.nsfwPolicy
  if (body.autoPlayVideo !== undefined) user.autoPlayVideo = body.autoPlayVideo

  await sequelizeTypescript.transaction(async t => {
    await user.save({ transaction: t })

    if (body.displayName !== undefined) user.Account.name = body.displayName
    if (body.description !== undefined) user.Account.description = body.description
    await user.Account.save({ transaction: t })

    await sendUpdateActor(user.Account, t)

    auditLogger.update(
      res.locals.oauth.token.User.Account.Actor.getIdentifier(),
      new UserAuditView(user.toFormattedJSON()),
      oldUserAuditView
    )
  })

  return res.sendStatus(204)
}

async function updateMyAvatar (req: express.Request, res: express.Response, next: express.NextFunction) {
  const avatarPhysicalFile = req.files[ 'avatarfile' ][ 0 ]
  const user: UserModel = res.locals.oauth.token.user
  const oldUserAuditView = new UserAuditView(user.toFormattedJSON())
  const account = user.Account

  const avatar = await updateActorAvatarFile(avatarPhysicalFile, account.Actor, account)

  auditLogger.update(
    res.locals.oauth.token.User.Account.Actor.getIdentifier(),
    new UserAuditView(user.toFormattedJSON()),
    oldUserAuditView
  )

  return res
    .json({
      avatar: avatar.toFormattedJSON()
    })
    .end()
}
