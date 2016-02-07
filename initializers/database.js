'use strict'

var config = require('config')
var mongoose = require('mongoose')

var logger = require('../helpers/logger')

var dbname = 'peertube' + config.get('database.suffix')
var host = config.get('database.host')
var port = config.get('database.port')

var database = {
  connect: connect
}

function connect () {
  mongoose.connect('mongodb://' + host + ':' + port + '/' + dbname)
  mongoose.connection.on('error', function () {
    logger.error('Mongodb connection error.')
    process.exit(0)
  })

  mongoose.connection.on('open', function () {
    logger.info('Connected to mongodb.')
  })
}

// ---------------------------------------------------------------------------

module.exports = database
