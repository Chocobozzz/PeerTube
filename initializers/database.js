;(function () {
  'use strict'

  var config = require('config')
  var mongoose = require('mongoose')

  var constants = require('./constants')
  var logger = require('../helpers/logger')

  var dbname = 'peertube' + config.get('database.suffix')
  var host = config.get('database.host')
  var port = config.get('database.port')

  // ----------- Pods -----------
  var podsSchema = mongoose.Schema({
    url: String,
    publicKey: String,
    score: { type: Number, max: constants.FRIEND_BASE_SCORE }
  })

  var PodsDB = mongoose.model('pods', podsSchema)

  // ----------- PoolRequests -----------
  var poolRequestsSchema = mongoose.Schema({
    type: String,
    id: String, // Special id to find duplicates (video created we want to remove...)
    request: mongoose.Schema.Types.Mixed
  })

  var PoolRequestsDB = mongoose.model('poolRequests', poolRequestsSchema)

  // ----------- Videos -----------
  var videosSchema = mongoose.Schema({
    name: String,
    namePath: String,
    description: String,
    magnetUri: String,
    podUrl: String
  })

  var VideosDB = mongoose.model('videos', videosSchema)

  // ---------------------------------------------------------------------------

  module.exports = {
    PodsDB: PodsDB,
    PoolRequestsDB: PoolRequestsDB,
    VideosDB: VideosDB
  }

  // ----------- Connection -----------

  mongoose.connect('mongodb://' + host + ':' + port + '/' + dbname)
  mongoose.connection.on('error', function () {
    logger.error('Mongodb connection error.')
    process.exit(0)
  })

  mongoose.connection.on('open', function () {
    logger.info('Connected to mongodb.')
  })
})()
