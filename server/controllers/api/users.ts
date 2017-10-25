import * as express from 'express'

import { database as db } from '../../initializers/database'
import { USER_ROLES, CONFIG } from '../../initializers'
import { logger, getFormattedObjects, retryTransactionWrapper } from '../../helpers'
import {
  authenticate,
  ensureIsAdmin,
  ensureUserRegistrationAllowed,
  usersAddValidator,
  usersRegisterValidator,
  usersUpdateValidator,
  usersUpdateMeValidator,
  usersRemoveValidator,
  usersVideoRatingValidator,
  usersGetValidator,
  paginationValidator,
  setPagination,
  usersSortValidator,
  setUsersSort,
  token,
  asyncMiddleware
} from '../../middlewares'
import {
  UserVideoRate as FormattedUserVideoRate,
  UserCreate,
  UserUpdate,
  UserUpdateMe
} from '../../../shared'
import { createUserAuthorAndChannel } from '../../lib'
import { UserInstance } from '../../models'

const usersRouter = express.Router()

usersRouter.get('/me',
  authenticate,
  asyncMiddleware(getUserInformation)
)

usersRouter.get('/me/videos/:videoId/rating',
  authenticate,
  usersVideoRatingValidator,
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
  usersGetValidator,
  getUser
)

usersRouter.post('/',
  authenticate,
  ensureIsAdmin,
  usersAddValidator,
  createUserRetryWrapper
)

usersRouter.post('/register',
  ensureUserRegistrationAllowed,
  usersRegisterValidator,
  asyncMiddleware(registerUser)
)

usersRouter.put('/me',
  authenticate,
  usersUpdateMeValidator,
  asyncMiddleware(updateMe)
)

usersRouter.put('/:id',
  authenticate,
  ensureIsAdmin,
  usersUpdateValidator,
  asyncMiddleware(updateUser)
)

usersRouter.delete('/:id',
  authenticate,
  ensureIsAdmin,
  usersRemoveValidator,
  asyncMiddleware(removeUser)
)

usersRouter.post('/token', token, success)
// TODO: Once https://github.com/oauthjs/node-oauth2-server/pull/289 is merged, implement revoke token route

// ---------------------------------------------------------------------------

export {
  usersRouter
}

// ---------------------------------------------------------------------------

async function createUserRetryWrapper (req: express.Request, res: express.Response, next: express.NextFunction) {
  const options = {
    arguments: [ req, res ],
    errorMessage: 'Cannot insert the user with many retries.'
  }

  await retryTransactionWrapper(createUser, options)

  // TODO : include Location of the new user -> 201
  return res.type('json').status(204).end()
}

async function createUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserCreate = req.body
  const user = db.User.build({
    username: body.username,
    password: body.password,
    email: body.email,
    displayNSFW: false,
    role: USER_ROLES.USER,
    videoQuota: body.videoQuota
  })

  await createUserAuthorAndChannel(user)

  logger.info('User %s with its channel and author created.', body.username)
}

async function registerUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserCreate = req.body

  const user = db.User.build({
    username: body.username,
    password: body.password,
    email: body.email,
    displayNSFW: false,
    role: USER_ROLES.USER,
    videoQuota: CONFIG.USER.VIDEO_QUOTA
  })

  await createUserAuthorAndChannel(user)
  return res.type('json').status(204).end()
}

async function getUserInformation (req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = await db.User.loadByUsernameAndPopulateChannels(res.locals.oauth.token.user.username)

  return res.json(user.toFormattedJSON())
}

function getUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  return res.json(res.locals.user.toFormattedJSON())
}

async function getUserVideoRating (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoId = +req.params.videoId
  const userId = +res.locals.oauth.token.User.id

  db.UserVideoRate.load(userId, videoId, null)
    .then(ratingObj => {
      const rating = ratingObj ? ratingObj.type : 'none'
      const json: FormattedUserVideoRate = {
        videoId,
        rating
      }
      res.json(json)
    })
    .catch(err => next(err))
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

  await user.save()

  return res.sendStatus(204)
}

function success (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.end()
}
