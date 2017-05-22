import express = require('express')
import { waterfall } from 'async'

import { database as db } from '../../initializers/database'
import { CONFIG, USER_ROLES } from '../../initializers'
import { logger, getFormatedObjects } from '../../helpers'
import {
  authenticate,
  ensureIsAdmin,
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
  ensureRegistrationEnabled,
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

function ensureRegistrationEnabled (req, res, next) {
  const registrationEnabled = CONFIG.SIGNUP.ENABLED

  if (registrationEnabled === true) {
    return next()
  }

  return res.status(400).send('User registration is not enabled.')
}

function createUser (req, res, next) {
  const user = db.User.build({
    username: req.body.username,
    password: req.body.password,
    email: req.body.email,
    displayNSFW: false,
    role: USER_ROLES.USER
  })

  user.save().asCallback(function (err, createdUser) {
    if (err) return next(err)

    return res.type('json').status(204).end()
  })
}

function getUserInformation (req, res, next) {
  db.User.loadByUsername(res.locals.oauth.token.user.username, function (err, user) {
    if (err) return next(err)

    return res.json(user.toFormatedJSON())
  })
}

function getUserVideoRating (req, res, next) {
  const videoId = req.params.videoId
  const userId = res.locals.oauth.token.User.id

  db.UserVideoRate.load(userId, videoId, null, function (err, ratingObj) {
    if (err) return next(err)

    const rating = ratingObj ? ratingObj.type : 'none'

    res.json({
      videoId,
      rating
    })
  })
}

function listUsers (req, res, next) {
  db.User.listForApi(req.query.start, req.query.count, req.query.sort, function (err, usersList, usersTotal) {
    if (err) return next(err)

    res.json(getFormatedObjects(usersList, usersTotal))
  })
}

function removeUser (req, res, next) {
  waterfall([
    function loadUser (callback) {
      db.User.loadById(req.params.id, callback)
    },

    function deleteUser (user, callback) {
      user.destroy().asCallback(callback)
    }
  ], function andFinally (err) {
    if (err) {
      logger.error('Errors when removed the user.', { error: err })
      return next(err)
    }

    return res.sendStatus(204)
  })
}

function updateUser (req, res, next) {
  db.User.loadByUsername(res.locals.oauth.token.user.username, function (err, user) {
    if (err) return next(err)

    if (req.body.password) user.password = req.body.password
    if (req.body.displayNSFW !== undefined) user.displayNSFW = req.body.displayNSFW

    user.save().asCallback(function (err) {
      if (err) return next(err)

      return res.sendStatus(204)
    })
  })
}

function success (req, res, next) {
  res.end()
}
