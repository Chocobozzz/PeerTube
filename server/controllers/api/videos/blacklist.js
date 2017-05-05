'use strict'

const express = require('express')

const db = require('../../../initializers/database')
const logger = require('../../../helpers/logger')
const middlewares = require('../../../middlewares')
const admin = middlewares.admin
const oAuth = middlewares.oauth
const validators = middlewares.validators
const validatorsVideos = validators.videos

const router = express.Router()

router.post('/:id/blacklist',
  oAuth.authenticate,
  admin.ensureIsAdmin,
  validatorsVideos.videosBlacklist,
  addVideoToBlacklist
)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function addVideoToBlacklist (req, res, next) {
  const videoInstance = res.locals.video

  const toCreate = {
    videoId: videoInstance.id
  }

  db.BlacklistedVideo.create(toCreate).asCallback(function (err) {
    if (err) {
      logger.error('Errors when blacklisting video ', { error: err })
      return next(err)
    }

    return res.type('json').status(204).end()
  })
}
