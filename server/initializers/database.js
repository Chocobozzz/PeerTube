'use strict'

const config = require('config')
const mongoose = require('mongoose')

const logger = require('../helpers/logger')

// Bootstrap models
require('../models/user')
require('../models/oauth-client')
require('../models/oauth-token')
require('../models/pods')
require('../models/video')
// Request model needs Video model
require('../models/request')

const dbname = 'peertube' + config.get('database.suffix')
const host = config.get('database.host')
const port = config.get('database.port')

const database = {
  connect: connect
}

function connect () {
  mongoose.connect('mongodb://' + host + ':' + port + '/' + dbname)
  mongoose.connection.on('error', function () {
    throw new Error('Mongodb connection error.')
  })

  mongoose.connection.on('open', function () {
    logger.info('Connected to mongodb.')
  })
}

// ---------------------------------------------------------------------------

module.exports = database
