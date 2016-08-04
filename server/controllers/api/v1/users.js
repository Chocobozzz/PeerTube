'use strict'

const each = require('async/each')
const config = require('config')
const express = require('express')
const mongoose = require('mongoose')
const waterfall = require('async/waterfall')

const constants = require('../../../initializers/constants')
const friends = require('../../../lib/friends')
const logger = require('../../../helpers/logger')
const middlewares = require('../../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth
const validatorsUsers = middlewares.validators.users

const Client = mongoose.model('OAuthClient')
const User = mongoose.model('User')
const Video = mongoose.model('Video')

const router = express.Router()

router.get('/', listUsers)

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

router.delete('/:username',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  validatorsUsers.usersRemove,
  removeUser
)
router.get('/client', getAngularClient)
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

function getAngularClient (req, res, next) {
  const serverHost = config.get('webserver.host')
  const serverPort = config.get('webserver.port')
  let headerHostShouldBe = serverHost
  if (serverPort !== 80 && serverPort !== 443) {
    headerHostShouldBe += ':' + serverPort
  }

  // Don't make this check if this is a test instance
  if (process.env.NODE_ENV !== 'test' && req.get('host') !== headerHostShouldBe) {
    return res.type('json').status(403).end()
  }

  Client.loadFirstClient(function (err, client) {
    if (err) return next(err)
    if (!client) return next(new Error('No client available.'))

    res.json({
      client_id: client._id,
      client_secret: client.clientSecret
    })
  })
}

function listUsers (req, res, next) {
  User.list(function (err, usersList) {
    if (err) return next(err)

    res.json(getFormatedUsers(usersList))
  })
}

function removeUser (req, res, next) {
  waterfall([
    function getUser (callback) {
      User.loadByUsername(req.params.username, callback)
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

    return res.type('json').status(204).end()
  })
}

function updateUser (req, res, next) {
  User.loadByUsername(res.locals.oauth.token.user.username, function (err, user) {
    if (err) return next(err)

    user.password = req.body.password
    user.save(function (err) {
      if (err) return next(err)

      return res.json('json').status(204).end()
    })
  })
}

function success (req, res, next) {
  res.end()
}

// ---------------------------------------------------------------------------

function getFormatedUsers (users) {
  const formatedUsers = []

  users.forEach(function (user) {
    formatedUsers.push(user.toFormatedJSON())
  })

  return {
    data: formatedUsers
  }
}
