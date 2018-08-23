import * as express from 'express'
import 'multer'
import { UserUpdateMe, UserVideoRate as FormattedUserVideoRate } from '../../../../shared'
import { getFormattedObjects } from '../../../helpers/utils'
import { CONFIG, IMAGE_MIMETYPE_EXT, sequelizeTypescript } from '../../../initializers'
import { sendUpdateActor } from '../../../lib/activitypub/send'
import {
  asyncMiddleware,
  authenticate,
  commonVideosFiltersValidator,
  paginationValidator,
  setDefaultPagination,
  setDefaultSort,
  userSubscriptionAddValidator,
  userSubscriptionGetValidator,
  usersUpdateMeValidator,
  usersVideoRatingValidator
} from '../../../middlewares'
import {
  deleteMeValidator,
  userSubscriptionsSortValidator,
  videoImportsSortValidator,
  videosSortValidator,
  areSubscriptionsExistValidator
} from '../../../middlewares/validators'
import { AccountVideoRateModel } from '../../../models/account/account-video-rate'
import { UserModel } from '../../../models/account/user'
import { VideoModel } from '../../../models/video/video'
import { VideoSortField } from '../../../../client/src/app/shared/video/sort-field.type'
import { buildNSFWFilter, createReqFiles } from '../../../helpers/express-utils'
import { UserVideoQuota } from '../../../../shared/models/users/user-video-quota.model'
import { updateAvatarValidator } from '../../../middlewares/validators/avatar'
import { updateActorAvatarFile } from '../../../lib/avatar'
import { auditLoggerFactory, UserAuditView } from '../../../helpers/audit-logger'
import { VideoImportModel } from '../../../models/video/video-import'
import { VideoFilter } from '../../../../shared/models/videos/video-query.type'
import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { JobQueue } from '../../../lib/job-queue'
import { logger } from '../../../helpers/logger'

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

// ##### Subscriptions part #####

meRouter.get('/me/subscriptions/videos',
  authenticate,
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  commonVideosFiltersValidator,
  asyncMiddleware(getUserSubscriptionVideos)
)

meRouter.get('/me/subscriptions/exist',
  authenticate,
  areSubscriptionsExistValidator,
  asyncMiddleware(areSubscriptionsExist)
)

meRouter.get('/me/subscriptions',
  authenticate,
  paginationValidator,
  userSubscriptionsSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(getUserSubscriptions)
)

meRouter.post('/me/subscriptions',
  authenticate,
  userSubscriptionAddValidator,
  asyncMiddleware(addUserSubscription)
)

meRouter.get('/me/subscriptions/:uri',
  authenticate,
  userSubscriptionGetValidator,
  getUserSubscription
)

meRouter.delete('/me/subscriptions/:uri',
  authenticate,
  userSubscriptionGetValidator,
  asyncMiddleware(deleteUserSubscription)
)

// ---------------------------------------------------------------------------

export {
  meRouter
}

// ---------------------------------------------------------------------------

async function areSubscriptionsExist (req: express.Request, res: express.Response) {
  const uris = req.query.uris as string[]
  const user = res.locals.oauth.token.User as UserModel

  const handles = uris.map(u => {
    let [ name, host ] = u.split('@')
    if (host === CONFIG.WEBSERVER.HOST) host = null

    return { name, host, uri: u }
  })

  const results = await ActorFollowModel.listSubscribedIn(user.Account.Actor.id, handles)

  const existObject: { [id: string ]: boolean } = {}
  for (const handle of handles) {
    const obj = results.find(r => {
      const server = r.ActorFollowing.Server

      return r.ActorFollowing.preferredUsername === handle.name &&
        (
          (!server && !handle.host) ||
          (server.host === handle.host)
        )
    })

    existObject[handle.uri] = obj !== undefined
  }

  return res.json(existObject)
}

async function addUserSubscription (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User as UserModel
  const [ name, host ] = req.body.uri.split('@')

  const payload = {
    name,
    host,
    followerActorId: user.Account.Actor.id
  }

  JobQueue.Instance.createJob({ type: 'activitypub-follow', payload })
          .catch(err => logger.error('Cannot create follow job for subscription %s.', req.body.uri, err))

  return res.status(204).end()
}

function getUserSubscription (req: express.Request, res: express.Response) {
  const subscription: ActorFollowModel = res.locals.subscription

  return res.json(subscription.ActorFollowing.VideoChannel.toFormattedJSON())
}

async function deleteUserSubscription (req: express.Request, res: express.Response) {
  const subscription: ActorFollowModel = res.locals.subscription

  await sequelizeTypescript.transaction(async t => {
    return subscription.destroy({ transaction: t })
  })

  return res.type('json').status(204).end()
}

async function getUserSubscriptions (req: express.Request, res: express.Response) {
  const user = res.locals.oauth.token.User as UserModel
  const actorId = user.Account.Actor.id

  const resultList = await ActorFollowModel.listSubscriptionsForApi(actorId, req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function getUserSubscriptionVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.User as UserModel
  const resultList = await VideoModel.listForApi({
    start: req.query.start,
    count: req.query.count,
    sort: req.query.sort,
    includeLocalVideos: false,
    categoryOneOf: req.query.categoryOneOf,
    licenceOneOf: req.query.licenceOneOf,
    languageOneOf: req.query.languageOneOf,
    tagsOneOf: req.query.tagsOneOf,
    tagsAllOf: req.query.tagsAllOf,
    nsfw: buildNSFWFilter(res, req.query.nsfw),
    filter: req.query.filter as VideoFilter,
    withFiles: false,
    actorId: user.Account.Actor.id
  })

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

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
  return res.json(json)
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

  return res.json({ avatar: avatar.toFormattedJSON() })
}
