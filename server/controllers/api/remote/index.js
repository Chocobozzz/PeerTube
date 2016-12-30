'use strict'

const express = require('express')

const utils = require('../../../helpers/utils')

const router = express.Router()

const videosRemoteController = require('./videos')

router.use('/videos', videosRemoteController)
router.use('/*', utils.badRequest)

// ---------------------------------------------------------------------------

module.exports = router
