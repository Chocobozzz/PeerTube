'use strict'

const each = require('async/each')
const express = require('express')
const mongoose = require('mongoose')
const waterfall = require('async/waterfall')

const constants = require('../../initializers/constants')
const friends = require('../../lib/friends')
const logger = require('../../helpers/logger')
const middlewares = require('../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth
const pagination = middlewares.pagination
const sort = middlewares.sort
const validatorsPagination = middlewares.validators.pagination
const validatorsSort = middlewares.validators.sort
const validatorsUsers = middlewares.validators.users

const User = mongoose.model('User')
const Video = mongoose.model('Video')

const router = express.Router()

router.get('/me', oAuth.authenticate, getUserInformation)

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

function createUser (req, res, next) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
    role: constants.USER_ROLES.USER
  })

  user.save(function (err, createdUser) {
    if (err) return next(err)

    return res.type('json').status(204).end()
  })
}

function getUserInformation (req, res, next) {
  User.loadByUsername(res.locals.oauth.token.user.username, function (err, user) {
    if (err) return next(err)

    return res.json(user.toFormatedJSON())
  })
}

function listUsers (req, res, next) {
  User.listForApi(req.query.start, req.query.count, req.query.sort, function (err, usersList, usersTotal) {
    if (err) return next(err)

    res.json(getFormatedUsers(usersList, usersTotal))
  })
}

function removeUser (req, res, next) {
  waterfall([
    function getUser (callback) {
      User.loadById(req.params.id, callback)
    },

    function getVideos (user, callback) {
      Video.listOwnedByAuthor(user.username, function (err, videos) {
        return callback(err, user, videos)
      })
    },

    function removeVideosFromDB (user, videos, callback) {
      each(videos, function (video, callbackEach) {
        video.remove(callbackEach)
      }, function (err) {
        return callback(err, user, videos)
      })
    },

    function sendInformationToFriends (user, videos, callback) {
      videos.forEach(function (video) {
        const params = {
          name: video.name,
          magnetUri: video.magnetUri
        }

        friends.removeVideoToFriends(params)
      })

      return callback(null, user)
    },

    function removeUserFromDB (user, callback) {
      user.remove(callback)
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
  User.loadByUsername(res.locals.oauth.token.user.username, function (err, user) {
    if (err) return next(err)

    user.password = req.body.password
    user.save(function (err) {
      if (err) return next(err)

      return res.sendStatus(204)
    })
  })
}

function success (req, res, next) {
  res.end()
}

// ---------------------------------------------------------------------------

function getFormatedUsers (users, usersTotal) {
  const formatedUsers = []

  users.forEach(function (user) {
    formatedUsers.push(user.toFormatedJSON())
  })

  return {
    total: usersTotal,
    data: formatedUsers
  }
}
