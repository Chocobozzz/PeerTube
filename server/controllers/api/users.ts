import * as express from 'express'
import { extname, join } from 'path'
import * as sharp from 'sharp'
import * as uuidv4 from 'uuid/v4'
import { UserCreate, UserRight, UserRole, UserUpdate, UserUpdateMe, UserVideoRate as FormattedUserVideoRate } from '../../../shared'
import { unlinkPromise } from '../../helpers/core-utils'
import { retryTransactionWrapper } from '../../helpers/database-utils'
import { logger } from '../../helpers/logger'
import { createReqFiles, getFormattedObjects } from '../../helpers/utils'
import { AVATAR_MIMETYPE_EXT, AVATARS_SIZE, CONFIG, sequelizeTypescript } from '../../initializers'
import { updateActorAvatarInstance } from '../../lib/activitypub'
import { sendUpdateUser } from '../../lib/activitypub/send'
import { createUserAccountAndChannel } from '../../lib/user'
import {
  asyncMiddleware, authenticate, ensureUserHasRight, ensureUserRegistrationAllowed, paginationValidator, setDefaultSort,
  setDefaultPagination, token, usersAddValidator, usersGetValidator, usersRegisterValidator, usersRemoveValidator, usersSortValidator,
  usersUpdateMeValidator, usersUpdateValidator, usersVideoRatingValidator
} from '../../middlewares'
import { usersUpdateMyAvatarValidator, videosSortValidator } from '../../middlewares/validators'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { UserModel } from '../../models/account/user'
import { VideoModel } from '../../models/video/video'

const reqAvatarFile = createReqFiles('avatarfile', CONFIG.STORAGE.AVATARS_DIR, AVATAR_MIMETYPE_EXT)

const usersRouter = express.Router()

/**
 *
 * @api {get} /user/me Get my information
 * @apiName GetMe
 * @apiGroup User
 * @apiVersion  1.0.0
 *
 * @apiSuccessExample {type} Success-Response:
 *  {
 *    id: string,
 *    username: string,
 *    email: string,
 *    displayNSFW: boolean,
 *    autoPlayVideo: boolean,
 *    role: string,
 *    roleLabel: string,
 *    videoQuota: number,
 *    createdAt: string,
 *    account: {
 *      id: number
 *      uuid: string
 *      url: string
 *      name: string
 *      host: string
 *      followingCount: number
 *      followersCount: number
 *      createdAt: Date
 *      updatedAt: Date
 *      avatar: Avatar
 *      displayName: string
 *    },
 *    videoChannels: []
 *  }
 *
 */
usersRouter.get('/me',
  authenticate,
  asyncMiddleware(getUserInformation)
)

/**
 *
 * @api {get} /user/me/video-quota-used Get my quota usage
 * @apiName GetMeVideoQuotaUsed
 * @apiGroup User
 * @apiVersion  1.0.0
 *
 * @apiSuccess (200) {number} UserVideoQuotaUsed Amount of quota used
 *
 */
usersRouter.get('/me/video-quota-used',
  authenticate,
  asyncMiddleware(getUserVideoQuotaUsed)
)

/**
 *
 * @api {get} /user/me/video Get my videos
 * @apiName GetMeVideos
 * @apiGroup User
 * @apiVersion  1.0.0
 *
 * @apiSuccessExample {String} Success-Response:
 *  [
 *    {
 *      id: number
 *      uuid: string
 *      accountName: string
 *      createdAt: Date | string
 *      updatedAt: Date | string
 *      categoryLabel: string
 *      category: number
 *      licenceLabel: string
 *      licence: number
 *      languageLabel: string
 *      language: number
 *      description: string
 *      duration: number
 *      isLocal: boolean
 *      name: string
 *      serverHost: string
 *      thumbnailPath: string
 *      previewPath: string
 *      embedPath: string
 *      views: number
 *      likes: number
 *      dislikes: number
 *      nsfw: boolean
 *    },
 *    ...
 *  ]
 *
 */
usersRouter.get('/me/videos',
  authenticate,
  paginationValidator,
  videosSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(getUserVideos)
)

/**
 *
 * @api {get} /user/me/videos/:videoId/rating Get the rating of one of my video
 * @apiName GetMeVideoRating
 * @apiGroup User
 * @apiVersion  1.0.0
 *
 * @apiSuccess {String} id Id of the video
 * @apiSuccess {number} rating Rating of the video
 *
 * @apiSuccessExample {String} Success-Response:
 *  {
 *     String,
 *     Number
 *  }
 *
 */
usersRouter.get('/me/videos/:videoId/rating',
  authenticate,
  asyncMiddleware(usersVideoRatingValidator),
  asyncMiddleware(getUserVideoRating)
)

/**
 *
 * @api {get} /user Get a list of all users
 * @apiName GetUsers
 * @apiGroup User
 * @apiVersion  1.0.0
 * @apiPermission MANAGE_USERS
 *
 * @apiSuccessExample {String} Success-Response:
 *  {
 *     [
 *       {
 *         id: string,
 *         username: string,
 *         email: string,
 *         displayNSFW: boolean,
 *         autoPlayVideo: boolean,
 *         role: string,
 *         roleLabel: string,
 *         videoQuota: number,
 *         createdAt: string,
 *         account: {
 *           id: number
 *           uuid: string
 *           url: string
 *           name: string
 *           host: string
 *           followingCount: number
 *           followersCount: number
 *           createdAt: Date
 *           updatedAt: Date
 *           avatar: Avatar
 *           displayName: string
 *         },
 *         videoChannels: []
 *       },
 *       ...
 *     ]
 *  }
 *
 */
usersRouter.get('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  paginationValidator,
  usersSortValidator,
  setDefaultSort,
  setDefaultPagination,
  asyncMiddleware(listUsers)
)

/**
 *
 * @api {get} /user/:id Get a user information
 * @apiName GetUser
 * @apiGroup User
 * @apiVersion  1.0.0
 *
 * @apiParam  {String} id The user id
 *
 * @apiSuccessExample {type} Success-Response:
 *  {
 *    id: string,
 *    username: string,
 *    email: string,
 *    displayNSFW: boolean,
 *    autoPlayVideo: boolean,
 *    role: string,
 *    roleLabel: string,
 *    videoQuota: number,
 *    createdAt: string,
 *    account: {
 *      id: number
 *      uuid: string
 *      url: string
 *      name: string
 *      host: string
 *      followingCount: number
 *      followersCount: number
 *      createdAt: Date
 *      updatedAt: Date
 *      avatar: Avatar
 *      displayName: string
 *    },
 *    videoChannels: []
 *  }
 *
 */
usersRouter.get('/:id',
  asyncMiddleware(usersGetValidator),
  getUser
)

/**
 *
 * @api {post} /user Create a user
 * @apiName AddUser
 * @apiGroup User
 * @apiVersion  1.0.0
 * @apiPermission MANAGE_USERS
 *
 * @apiParam  {String} username The user username
 * @apiParam  {String} password The user password
 * @apiParam  {String} email The user email
 * @apiParam  {String} videoQuota The user videoQuota
 * @apiParam  {String} role The user role
 *
 */
usersRouter.post('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersAddValidator),
  asyncMiddleware(createUserRetryWrapper)
)

/**
 *
 * @api {post} /user/register Register a new user
 * @apiName RegisterUser
 * @apiGroup User
 * @apiVersion  1.0.0
 *
 * @apiParam  {String} username The username of the user
 * @apiParam  {String} password The password of the user
 * @apiParam  {String} email The email of the user
 *
 */
usersRouter.post('/register',
  asyncMiddleware(ensureUserRegistrationAllowed),
  asyncMiddleware(usersRegisterValidator),
  asyncMiddleware(registerUserRetryWrapper)
)

/**
 *
 * @api {put} /user/me Update my information
 * @apiName UpdateMe
 * @apiGroup User
 * @apiVersion  1.0.0
 *
 * @apiParam  {String} password Your new password
 * @apiParam  {String} email Your new email
 * @apiParam  {String} displayNSFW Your new displayNSFW
 * @apiParam  {String} autoPlayVideo Your new autoPlayVideo
 *
 */
usersRouter.put('/me',
  authenticate,
  usersUpdateMeValidator,
  asyncMiddleware(updateMe)
)

/**
 *
 * @api {post} /user/me/avatar/pick Set my avatar
 * @apiName SetMeAvatar
 * @apiGroup User
 * @apiVersion  1.0.0
 *
 * @apiParam  {File} avatarfile The avatar file
 *
 */
usersRouter.post('/me/avatar/pick',
  authenticate,
  reqAvatarFile,
  usersUpdateMyAvatarValidator,
  asyncMiddleware(updateMyAvatar)
)

/**
 *
 * @api {put} /user/:id Update a user
 * @apiName UpdateUser
 * @apiGroup User
 * @apiVersion  1.0.0
 * @apiPermission MANAGE_USERS
 *
 * @apiParam  {String} id The user id
 * @apiParam  {String} email The updated email of the user
 * @apiParam  {String} videoQuota The updated videoQuota of the user
 * @apiParam  {String} role The updated role of the user
 *
 */
usersRouter.put('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersUpdateValidator),
  asyncMiddleware(updateUser)
)

/**
 *
 * @api {delete} /user/:id Delete a user
 * @apiName DeleteUser
 * @apiGroup User
 * @apiVersion  1.0.0
 * @apiPermission MANAGE_USERS
 *
 * @apiParam  {String} id The user id
 *
 */
usersRouter.delete('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersRemoveValidator),
  asyncMiddleware(removeUser)
)

usersRouter.post('/token', token, success)
// TODO: Once https://github.com/oauthjs/node-oauth2-server/pull/289 is merged, implement revoke token route

// ---------------------------------------------------------------------------

export {
  usersRouter
}

// ---------------------------------------------------------------------------

async function getUserVideos (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = res.locals.oauth.token.User as UserModel
  const resultList = await VideoModel.listUserVideosForApi(user.id ,req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function createUserRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req ],
    errorMessage: 'Cannot insert the user with many retries.'
  }

  const { user, account } = await retryTransactionWrapper(createUser, options)

  return res.json({
    user: {
      id: user.id,
      uuid: account.uuid
    }
  }).end()
}

async function createUser (req: express.Request) {
  const body: UserCreate = req.body
  const userToCreate = new UserModel({
    username: body.username,
    password: body.password,
    email: body.email,
    displayNSFW: false,
    autoPlayVideo: true,
    role: body.role,
    videoQuota: body.videoQuota
  })

  const { user, account } = await createUserAccountAndChannel(userToCreate)

  logger.info('User %s with its channel and account created.', body.username)

  return { user, account }
}

async function registerUserRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req ],
    errorMessage: 'Cannot insert the user with many retries.'
  }

  await retryTransactionWrapper(registerUser, options)

  return res.type('json').status(204).end()
}

async function registerUser (req: express.Request) {
  const body: UserCreate = req.body

  const user = new UserModel({
    username: body.username,
    password: body.password,
    email: body.email,
    displayNSFW: false,
    autoPlayVideo: true,
    role: UserRole.USER,
    videoQuota: CONFIG.USER.VIDEO_QUOTA
  })

  await createUserAccountAndChannel(user)

  logger.info('User %s with its channel and account registered.', body.username)
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

  return res.json({
    videoQuotaUsed
  })
}

function getUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.json((res.locals.user as UserModel).toFormattedJSON())
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

async function listUsers (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await UserModel.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = await UserModel.loadById(req.params.id)

  await user.destroy()

  return res.sendStatus(204)
}

async function updateMe (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserUpdateMe = req.body

  const user = res.locals.oauth.token.user

  if (body.password !== undefined) user.password = body.password
  if (body.email !== undefined) user.email = body.email
  if (body.displayNSFW !== undefined) user.displayNSFW = body.displayNSFW
  if (body.autoPlayVideo !== undefined) user.autoPlayVideo = body.autoPlayVideo

  await user.save()
  await sendUpdateUser(user, undefined)

  return res.sendStatus(204)
}

async function updateMyAvatar (req: express.Request, res: express.Response, next: express.NextFunction) {
  const avatarPhysicalFile = req.files['avatarfile'][0]
  const user = res.locals.oauth.token.user
  const actor = user.Account.Actor

  const avatarDir = CONFIG.STORAGE.AVATARS_DIR
  const source = join(avatarDir, avatarPhysicalFile.filename)
  const extension = extname(avatarPhysicalFile.filename)
  const avatarName = uuidv4() + extension
  const destination = join(avatarDir, avatarName)

  await sharp(source)
    .resize(AVATARS_SIZE.width, AVATARS_SIZE.height)
    .toFile(destination)

  await unlinkPromise(source)

  const avatar = await sequelizeTypescript.transaction(async t => {
    const updatedActor = await updateActorAvatarInstance(actor, avatarName, t)
    await updatedActor.save({ transaction: t })

    await sendUpdateUser(user, t)

    return updatedActor.Avatar
  })

  return res
    .json({
      avatar: avatar.toFormattedJSON()
    })
    .end()
}

async function updateUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserUpdate = req.body
  const user = res.locals.user as UserModel

  if (body.email !== undefined) user.email = body.email
  if (body.videoQuota !== undefined) user.videoQuota = body.videoQuota
  if (body.role !== undefined) user.role = body.role

  await user.save()

  // Don't need to send this update to followers, these attributes are not propagated

  return res.sendStatus(204)
}

function success (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.end()
}
