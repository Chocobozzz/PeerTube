'use strict'

const mongoose = require('mongoose')

const constants = require('../initializers/constants')
const logger = require('../helpers/logger')

// Bootstrap models
require('../models/application')
require('../models/oauth-token')
require('../models/user')
require('../models/oauth-client')
require('../models/video')
// Request model needs Video model
require('../models/pods')
// Request model needs Pod model
require('../models/request')

const database = {
  connect: connect
}

function connect () {
  mongoose.Promise = global.Promise
  mongoose.connect('mongodb://' + constants.CONFIG.DATABASE.HOSTNAME + ':' + constants.CONFIG.DATABASE.PORT + '/' + constants.CONFIG.DATABASE.DBNAME)
  mongoose.connection.on('error', function () {
    throw new Error('Mongodb connection error.')
  })

  mongoose.connection.on('open', function () {
    logger.info('Connected to mongodb.')
  })
}

// ---------------------------------------------------------------------------

module.exports = database
