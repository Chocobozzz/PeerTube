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
  asyncMiddleware, authenticate, ensureUserHasRight, ensureUserRegistrationAllowed, paginationValidator, setPagination, setUsersSort,
  setVideosSort, token, usersAddValidator, usersGetValidator, usersRegisterValidator, usersRemoveValidator, usersSortValidator,
  usersUpdateMeValidator, usersUpdateValidator, usersVideoRatingValidator
} from '../../middlewares'
import { usersUpdateMyAvatarValidator, videosSortValidator } from '../../middlewares/validators'
import { AccountVideoRateModel } from '../../models/account/account-video-rate'
import { UserModel } from '../../models/account/user'
import { VideoModel } from '../../models/video/video'

const reqAvatarFile = createReqFiles('avatarfile', CONFIG.STORAGE.AVATARS_DIR, AVATAR_MIMETYPE_EXT)

const usersRouter = express.Router()

usersRouter.get('/me',
  authenticate,
  asyncMiddleware(getUserInformation)
)

usersRouter.get('/me/videos',
  authenticate,
  paginationValidator,
  videosSortValidator,
  setVideosSort,
  setPagination,
  asyncMiddleware(getUserVideos)
)

usersRouter.get('/me/videos/:videoId/rating',
  authenticate,
  asyncMiddleware(usersVideoRatingValidator),
  asyncMiddleware(getUserVideoRating)
)

usersRouter.get('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  paginationValidator,
  usersSortValidator,
  setUsersSort,
  setPagination,
  asyncMiddleware(listUsers)
)

usersRouter.get('/:id',
  asyncMiddleware(usersGetValidator),
  getUser
)

usersRouter.post('/',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersAddValidator),
  asyncMiddleware(createUserRetryWrapper)
)

usersRouter.post('/register',
  asyncMiddleware(ensureUserRegistrationAllowed),
  asyncMiddleware(usersRegisterValidator),
  asyncMiddleware(registerUserRetryWrapper)
)

usersRouter.put('/me',
  authenticate,
  usersUpdateMeValidator,
  asyncMiddleware(updateMe)
)

usersRouter.post('/me/avatar/pick',
  authenticate,
  reqAvatarFile,
  usersUpdateMyAvatarValidator,
  asyncMiddleware(updateMyAvatar)
)

usersRouter.put('/:id',
  authenticate,
  ensureUserHasRight(UserRight.MANAGE_USERS),
  asyncMiddleware(usersUpdateValidator),
  asyncMiddleware(updateUser)
)

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

  await retryTransactionWrapper(createUser, options)

  // TODO : include Location of the new user -> 201
  return res.type('json').status(204).end()
}

async function createUser (req: express.Request) {
  const body: UserCreate = req.body
  const user = new UserModel({
    username: body.username,
    password: body.password,
    email: body.email,
    displayNSFW: false,
    autoPlayVideo: true,
    role: body.role,
    videoQuota: body.videoQuota
  })

  await createUserAccountAndChannel(user)

  logger.info('User %s with its channel and account created.', body.username)
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

function getUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.json(res.locals.user.toFormattedJSON())
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
