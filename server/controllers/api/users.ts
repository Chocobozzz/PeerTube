import * as express from 'express'

import { database as db } from '../../initializers/database'
import { USER_ROLES } from '../../initializers'
import { logger, getFormatedObjects } from '../../helpers'
import {
  authenticate,
  ensureIsAdmin,
  ensureUserRegistrationEnabled,
  usersAddValidator,
  usersUpdateValidator,
  usersRemoveValidator,
  usersVideoRatingValidator,
  paginationValidator,
  setPagination,
  usersSortValidator,
  setUsersSort,
  token
} from '../../middlewares'
import { UserVideoRate as FormatedUserVideoRate, UserCreate, UserUpdate } from '../../../shared'

const usersRouter = express.Router()

usersRouter.get('/me',
  authenticate,
  getUserInformation
)

usersRouter.get('/me/videos/:videoId/rating',
  authenticate,
  usersVideoRatingValidator,
  getUserVideoRating
)

usersRouter.get('/',
  paginationValidator,
  usersSortValidator,
  setUsersSort,
  setPagination,
  listUsers
)

usersRouter.post('/',
  authenticate,
  ensureIsAdmin,
  usersAddValidator,
  createUser
)

usersRouter.post('/register',
  ensureUserRegistrationEnabled,
  usersAddValidator,
  createUser
)

usersRouter.put('/:id',
  authenticate,
  usersUpdateValidator,
  updateUser
)

usersRouter.delete('/:id',
  authenticate,
  ensureIsAdmin,
  usersRemoveValidator,
  removeUser
)

usersRouter.post('/token', token, success)
// TODO: Once https://github.com/oauthjs/node-oauth2-server/pull/289 is merged, implement revoke token route

// ---------------------------------------------------------------------------

export {
  usersRouter
}

// ---------------------------------------------------------------------------

function createUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserCreate = req.body

  const user = db.User.build({
    username: body.username,
    password: body.password,
    email: body.email,
    displayNSFW: false,
    role: USER_ROLES.USER
  })

  user.save()
    .then(() => res.type('json').status(204).end())
    .catch(err => next(err))
}

function getUserInformation (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.User.loadByUsername(res.locals.oauth.token.user.username)
    .then(user => res.json(user.toFormatedJSON()))
    .catch(err => next(err))
}

function getUserVideoRating (req: express.Request, res: express.Response, next: express.NextFunction) {
  const videoId = +req.params.videoId
  const userId = +res.locals.oauth.token.User.id

  db.UserVideoRate.load(userId, videoId, null)
    .then(ratingObj => {
      const rating = ratingObj ? ratingObj.type : 'none'
      const json: FormatedUserVideoRate = {
        videoId,
        rating
      }
      res.json(json)
    })
    .catch(err => next(err))
}

function listUsers (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.User.listForApi(req.query.start, req.query.count, req.query.sort)
    .then(resultList => {
      res.json(getFormatedObjects(resultList.data, resultList.total))
    })
    .catch(err => next(err))
}

function removeUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  db.User.loadById(req.params.id)
    .then(user => user.destroy())
    .then(() => res.sendStatus(204))
    .catch(err => {
      logger.error('Errors when removed the user.', err)
      return next(err)
    })
}

function updateUser (req: express.Request, res: express.Response, next: express.NextFunction) {
  const body: UserUpdate = req.body

  db.User.loadByUsername(res.locals.oauth.token.user.username)
    .then(user => {
      if (body.password) user.password = body.password
      if (body.displayNSFW !== undefined) user.displayNSFW = body.displayNSFW

      return user.save()
    })
    .then(() => res.sendStatus(204))
    .catch(err => next(err))
}

function success (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.end()
}
