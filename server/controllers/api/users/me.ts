import * as express from 'express'
import 'multer'
import { UserUpdateMe, UserVideoRate as FormattedUserVideoRate } from '../../../../shared'
import { getFormattedObjects } from '../../../helpers/utils'
import { CONFIG, MIMETYPES, sequelizeTypescript } from '../../../initializers'
import { sendUpdateActor } from '../../../lib/activitypub/send'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
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
import { auditLoggerFactory, getAuditIdFromRes, UserAuditView } from '../../../helpers/audit-logger'
import { VideoImportModel } from '../../../models/video/video-import'
import { AccountModel } from '../../../models/account/account'

const auditLogger = auditLoggerFactory('users-me')

const reqAvatarFile = createReqFiles([ 'avatarfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT, { avatarfile: CONFIG.STORAGE.TMP_DIR })

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
  asyncMiddleware(usersUpdateMeValidator),
  asyncRetryTransactionMiddleware(updateMe)
)

meRouter.post('/me/avatar/pick',
  authenticate,
  reqAvatarFile,
  updateAvatarValidator,
  asyncRetryTransactionMiddleware(updateMyAvatar)
)

// ---------------------------------------------------------------------------

export {
  meRouter
}

// ---------------------------------------------------------------------------

async function getUserVideos (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
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

async function getUserVideoImports (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User
  const resultList = await VideoImportModel.listUserVideoImportsForApi(
    user.id,
    req.query.start as number,
    req.query.count as number,
    req.query.sort
  )

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function getUserInformation (req: express.Request, res: express.Response) {
  // We did not load channels in res.locals.user
  const user = await UserModel.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username)

  return res.json(user.toFormattedJSON())
}

async function getUserVideoQuotaUsed (req: express.Request, res: express.Response) {
  // We did not load channels in res.locals.user
  const user = await UserModel.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username)
  const videoQuotaUsed = await UserModel.getOriginalVideoFileTotalFromUser(user)
  const videoQuotaUsedDaily = await UserModel.getOriginalVideoFileTotalDailyFromUser(user)

  const data: UserVideoQuota = {
    videoQuotaUsed,
    videoQuotaUsedDaily
  }
  return res.json(data)
}

async function getUserVideoRating (req: express.Request, res: express.Response) {
  const videoId = res.locals.video.id
  const accountId = +res.locals.oauth.token.User.Account.id

  const ratingObj = await AccountVideoRateModel.load(accountId, videoId, null)
  const rating = ratingObj ? ratingObj.type : 'none'

  const json: FormattedUserVideoRate = {
    videoId,
    rating
  }
  return res.json(json)
}

async function deleteMe (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User

  await user.destroy()

  auditLogger.delete(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()))

  return res.sendStatus(204)
}

async function updateMe (req: express.Request, res: express.Response) {
  const body: UserUpdateMe = req.body

  const user = res.locals.oauth.token.user
  const oldUserAuditView = new UserAuditView(user.toFormattedJSON())

  if (body.password !== undefined) user.password = body.password
  if (body.email !== undefined) user.email = body.email
  if (body.nsfwPolicy !== undefined) user.nsfwPolicy = body.nsfwPolicy
  if (body.webTorrentEnabled !== undefined) user.webTorrentEnabled = body.webTorrentEnabled
  if (body.autoPlayVideo !== undefined) user.autoPlayVideo = body.autoPlayVideo
  if (body.videosHistoryEnabled !== undefined) user.videosHistoryEnabled = body.videosHistoryEnabled

  await sequelizeTypescript.transaction(async t => {
    const userAccount = await AccountModel.load(user.Account.id)

    await user.save({ transaction: t })

    if (body.displayName !== undefined) userAccount.name = body.displayName
    if (body.description !== undefined) userAccount.description = body.description
    await userAccount.save({ transaction: t })

    await sendUpdateActor(userAccount, t)

    auditLogger.update(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()), oldUserAuditView)
  })

  return res.sendStatus(204)
}

async function updateMyAvatar (req: express.Request, res: express.Response) {
  const avatarPhysicalFile = req.files[ 'avatarfile' ][ 0 ]
  const user = res.locals.oauth.token.user
  const oldUserAuditView = new UserAuditView(user.toFormattedJSON())

  const userAccount = await AccountModel.load(user.Account.id)

  const avatar = await updateActorAvatarFile(avatarPhysicalFile, userAccount)

  auditLogger.update(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()), oldUserAuditView)

  return res.json({ avatar: avatar.toFormattedJSON() })
}
