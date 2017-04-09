'use strict'

const express = require('express')
const waterfall = require('async/waterfall')

const constants = require('../../initializers/constants')
const db = require('../../initializers/database')
const logger = require('../../helpers/logger')
const utils = require('../../helpers/utils')
const middlewares = require('../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth
const pagination = middlewares.pagination
const sort = middlewares.sort
const validatorsPagination = middlewares.validators.pagination
const validatorsSort = middlewares.validators.sort
const validatorsUsers = middlewares.validators.users

const router = express.Router()

router.get('/me',
  oAuth.authenticate,
  getUserInformation
)

router.get('/me/videos/:videoId/rating',
  oAuth.authenticate,
  validatorsUsers.usersVideoRating,
  getUserVideoRating
)

router.get('/',
  validatorsPagination.pagination,
  validatorsSort.usersSort,
  sort.setUsersSort,
  pagination.setPagination,
  listUsers
)

router.post('/',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  validatorsUsers.usersAdd,
  createUser
)

router.post('/register',
  ensureRegistrationEnabled,
  validatorsUsers.usersAdd,
  createUser
)

router.put('/:id',
  oAuth.authenticate,
  validatorsUsers.usersUpdate,
  updateUser
)

router.delete('/:id',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  validatorsUsers.usersRemove,
  removeUser
)

router.post('/token', oAuth.token, success)
// TODO: Once https://github.com/oauthjs/node-oauth2-server/pull/289 is merged, implement revoke token route

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function ensureRegistrationEnabled (req, res, next) {
  const registrationEnabled = constants.CONFIG.SIGNUP.ENABLED

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
    role: constants.USER_ROLES.USER
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

  db.UserVideoRate.load(userId, videoId, function (err, ratingObj) {
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

    res.json(utils.getFormatedObjects(usersList, usersTotal))
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
