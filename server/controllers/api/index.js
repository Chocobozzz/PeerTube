'use strict'

const express = require('express')

const router = express.Router()

const clientsController = require('./clients')
const podsController = require('./pods')
const remoteController = require('./remote')
const requestsController = require('./requests')
const usersController = require('./users')
const videosController = require('./videos')

router.use('/clients', clientsController)
router.use('/pods', podsController)
router.use('/remote', remoteController)
router.use('/requests', requestsController)
router.use('/users', usersController)
router.use('/videos', videosController)
router.use('/ping', pong)
router.use('/*', badRequest)

// ---------------------------------------------------------------------------

module.exports = router

// ---------------------------------------------------------------------------

function pong (req, res, next) {
  return res.send('pong').status(200).end()
}

function badRequest (req, res, next) {
  res.type('json').status(400).end()
}
