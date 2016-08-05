'use strict'

const express = require('express')

const router = express.Router()

const clientsController = require('./clients')
const podsController = require('./pods')
const remoteController = require('./remote')
const usersController = require('./users')
const videosController = require('./videos')

router.use('/clients', clientsController)
router.use('/pods', podsController)
router.use('/remote', remoteController)
router.use('/users', usersController)
router.use('/videos', videosController)
router.use('/*', badRequest)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function badRequest (req, res, next) {
  res.type('json').status(400).end()
}
