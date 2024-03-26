import 'multer'
import express from 'express'
import { pick } from '@peertube/peertube-core-utils'
import {
  ActorImageType,
  HttpStatusCode,
  UserUpdateMe,
  UserVideoQuota,
  UserVideoRate as FormattedUserVideoRate
} from '@peertube/peertube-models'
import { auditLoggerFactory, getAuditIdFromRes, UserAuditView } from '@server/helpers/audit-logger.js'
import { Hooks } from '@server/lib/plugins/hooks.js'
import { AttributesOnly } from '@peertube/peertube-typescript-utils'
import { createReqFiles } from '../../../helpers/express-utils.js'
import { getFormattedObjects } from '../../../helpers/utils.js'
import { CONFIG } from '../../../initializers/config.js'
import { MIMETYPES } from '../../../initializers/constants.js'
import { sequelizeTypescript } from '../../../initializers/database.js'
import { sendUpdateActor } from '../../../lib/activitypub/send/index.js'
import { deleteLocalActorImageFile, updateLocalActorImageFiles } from '../../../lib/local-actor.js'
import { getOriginalVideoFileTotalDailyFromUser, getOriginalVideoFileTotalFromUser, sendVerifyUserEmail } from '../../../lib/user.js'
import {
  asyncMiddleware,
  asyncRetryTransactionMiddleware,
  authenticate,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  setDefaultVideosSort,
  usersUpdateMeValidator,
  usersVideoRatingValidator
} from '../../../middlewares/index.js'
import { updateAvatarValidator } from '../../../middlewares/validators/actor-image.js'
import {
  deleteMeValidator,
  getMyVideoImportsValidator,
  usersVideosValidator,
  videoImportsSortValidator,
  videosSortValidator
} from '../../../middlewares/validators/index.js'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate.js'
import { AccountModel } from '../../../models/account/account.js'
import { UserModel } from '../../../models/user/user.js'
import { VideoImportModel } from '../../../models/video/video-import.js'
import { VideoModel } from '../../../models/video/video.js'

const auditLogger = auditLoggerFactory('users')

const reqAvatarFile = createReqFiles([ 'avatarfile' ], MIMETYPES.IMAGE.MIMETYPE_EXT)

const meRouter = express.Router()

meRouter.get('/me',
  authenticate,
  asyncMiddleware(getUserInformation)
)
meRouter.delete('/me',
  authenticate,
  deleteMeValidator,
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
  getMyVideoImportsValidator,
  asyncMiddleware(getUserVideoImports)
)

meRouter.get('/me/videos',
  authenticate,
  paginationValidator,
  videosSortValidator,
  setDefaultVideosSort,
  setDefaultPagination,
  asyncMiddleware(usersVideosValidator),
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

meRouter.delete('/me/avatar',
  authenticate,
  asyncRetryTransactionMiddleware(deleteMyAvatar)
)

// ---------------------------------------------------------------------------

export {
  meRouter
}

// ---------------------------------------------------------------------------

async function getUserVideos (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User

  const apiOptions = await Hooks.wrapObject({
    accountId: user.Account.id,
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    search: req.query.search,
    channelId: res.locals.videoChannel?.id,
    isLive: req.query.isLive
  }, 'filter:api.user.me.videos.list.params')

  const resultList = await Hooks.wrapPromiseFun(
    VideoModel.listUserVideosForApi.bind(VideoModel),
    apiOptions,
    'filter:api.user.me.videos.list.result'
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
  const resultList = await VideoImportModel.listUserVideoImportsForApi({
    userId: user.id,

    ...pick(req.query, [ 'targetUrl', 'start', 'count', 'sort', 'search', 'videoChannelSyncId' ])
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function getUserInformation (req: express.Request, res: express.Response) {
  // We did not load channels in res.locals.user
  const user = await UserModel.loadForMeAPI(res.locals.oauth.token.user.id)

  const result = await Hooks.wrapObject(
    user.toMeFormattedJSON(),
    'filter:api.user.me.get.result',
    { user }
  )

  return res.json(result)
}

async function getUserVideoQuotaUsed (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.user
  const videoQuotaUsed = await getOriginalVideoFileTotalFromUser(user)
  const videoQuotaUsedDaily = await getOriginalVideoFileTotalDailyFromUser(user)

  const data: UserVideoQuota = {
    videoQuotaUsed,
    videoQuotaUsedDaily
  }
  return res.json(data)
}

async function getUserVideoRating (req: express.Request, res: express.Response) {
  const videoId = res.locals.videoId.id
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
  const user = await UserModel.loadByIdWithChannels(res.locals.oauth.token.User.id)

  auditLogger.delete(getAuditIdFromRes(res), new UserAuditView(user.toFormattedJSON()))

  await user.destroy()

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function updateMe (req: express.Request, res: express.Response) {
  const body: UserUpdateMe = req.body
  let sendVerificationEmail = false

  const user = res.locals.oauth.token.user

  const keysToUpdate: (keyof UserUpdateMe & keyof AttributesOnly<UserModel>)[] = [
    'password',
    'nsfwPolicy',
    'p2pEnabled',
    'autoPlayVideo',
    'autoPlayNextVideo',
    'autoPlayNextVideoPlaylist',
    'videosHistoryEnabled',
    'videoLanguages',
    'theme',
    'noInstanceConfigWarningModal',
    'noAccountSetupWarningModal',
    'noWelcomeModal',
    'emailPublic',
    'p2pEnabled'
  ]

  for (const key of keysToUpdate) {
    if (body[key] !== undefined) user.set(key, body[key])
  }

  if (body.email !== undefined) {
    if (CONFIG.SIGNUP.REQUIRES_EMAIL_VERIFICATION) {
      user.pendingEmail = body.email
      sendVerificationEmail = true
    } else {
      user.email = body.email
    }
  }

  await sequelizeTypescript.transaction(async t => {
    await user.save({ transaction: t })

    if (body.displayName === undefined && body.description === undefined) return

    const userAccount = await AccountModel.load(user.Account.id, t)

    if (body.displayName !== undefined) userAccount.name = body.displayName
    if (body.description !== undefined) userAccount.description = body.description
    await userAccount.save({ transaction: t })

    await sendUpdateActor(userAccount, t)
  })

  if (sendVerificationEmail === true) {
    await sendVerifyUserEmail(user, true)
  }

  return res.status(HttpStatusCode.NO_CONTENT_204).end()
}

async function updateMyAvatar (req: express.Request, res: express.Response) {
  const avatarPhysicalFile = req.files['avatarfile'][0]
  const user = res.locals.oauth.token.user

  const userAccount = await AccountModel.load(user.Account.id)

  const avatars = await updateLocalActorImageFiles({
    accountOrChannel: userAccount,
    imagePhysicalFile: avatarPhysicalFile,
    type: ActorImageType.AVATAR,
    sendActorUpdate: true
  })

  return res.json({
    avatars: avatars.map(avatar => avatar.toFormattedJSON())
  })
}

async function deleteMyAvatar (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.user

  const userAccount = await AccountModel.load(user.Account.id)
  await deleteLocalActorImageFile(userAccount, ActorImageType.AVATAR)

  return res.json({ avatars: [] })
}
