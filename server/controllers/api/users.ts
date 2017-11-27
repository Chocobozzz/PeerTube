import * as express from 'express'
import { UserCreate, UserRight, UserRole, UserUpdate, UserUpdateMe, UserVideoRate as FormattedUserVideoRate } from '../../../shared'
import { getFormattedObjects, logger, retryTransactionWrapper } from '../../helpers'
import { CONFIG, database as db } from '../../initializers'
import { createUserAccountAndChannel } from '../../lib'
import {
  asyncMiddleware,
  authenticate,
  ensureUserHasRight,
  ensureUserRegistrationAllowed,
  paginationValidator,
  setPagination,
  setUsersSort,
  token,
  usersAddValidator,
  usersGetValidator,
  usersRegisterValidator,
  usersRemoveValidator,
  usersSortValidator,
  usersUpdateMeValidator,
  usersUpdateValidator,
  usersVideoRatingValidator
} from '../../middlewares'
import { setVideosSort } from '../../middlewares/sort'
import { videosSortValidator } from '../../middlewares/validators/sort'
import { UserInstance } from '../../models'

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
  const user = res.locals.oauth.token.User
  const resultList = await db.Video.listUserVideosForApi(user.id ,req.query.start, req.query.count, req.query.sort)

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
  const user = db.User.build({
    username: body.username,
    password: body.password,
    email: body.email,
    displayNSFW: false,
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

  const user = db.User.build({
    username: body.username,
    password: body.password,
    email: body.email,
    displayNSFW: false,
    role: UserRole.USER,
    videoQuota: CONFIG.USER.VIDEO_QUOTA
  })

  await createUserAccountAndChannel(user)

  logger.info('User %s with its channel and account registered.', body.username)
}

async function getUserInformation (req: express.Request, res: express.Response, next: express.NextFunction) {
  // We did not load channels in res.locals.user
  const user = await db.User.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username)

  return res.json(user.toFormattedJSON())
}

function getUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.json(res.locals.user.toFormattedJSON())
}

async function getUserVideoRating (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoId = +req.params.videoId
  const accountId = +res.locals.oauth.token.User.Account.id

  const ratingObj = await db.AccountVideoRate.load(accountId, videoId, null)
  const rating = ratingObj ? ratingObj.type : 'none'

  const json: FormattedUserVideoRate = {
    videoId,
    rating
  }
  res.json(json)
}

async function listUsers (req: express.Request, res: express.Response, next: express.NextFunction) {
  const resultList = await db.User.listForApi(req.query.start, req.query.count, req.query.sort)

  return res.json(getFormattedObjects(resultList.data, resultList.total))
}

async function removeUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = await db.User.loadById(req.params.id)

  await user.destroy()

  return res.sendStatus(204)
}

async function updateMe (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserUpdateMe = req.body

  // FIXME: user is not already a Sequelize instance?
  const user = res.locals.oauth.token.user

  if (body.password !== undefined) user.password = body.password
  if (body.email !== undefined) user.email = body.email
  if (body.displayNSFW !== undefined) user.displayNSFW = body.displayNSFW

  await user.save()

  return res.sendStatus(204)
}

async function updateUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserUpdate = req.body
  const user: UserInstance = res.locals.user

  if (body.email !== undefined) user.email = body.email
  if (body.videoQuota !== undefined) user.videoQuota = body.videoQuota
  if (body.role !== undefined) user.role = body.role

  await user.save()

  return res.sendStatus(204)
}

function success (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.end()
}
