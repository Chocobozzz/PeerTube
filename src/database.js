;(function () {
  'use strict'

  var config = require('config')
  var mongoose = require('mongoose')

  var logger = require('./logger')

  var dbname = 'peertube' + config.get('database.suffix')
  var host = config.get('database.host')
  var port = config.get('database.port')

  // ----------- Videos -----------
  var videosSchema = mongoose.Schema({
    name: String,
    namePath: String,
    description: String,
    magnetUri: String,
    podUrl: String
  })

  var VideosDB = mongoose.model('videos', videosSchema)

  // ----------- Pods -----------
  var podsSchema = mongoose.Schema({
    url: String,
    publicKey: String
  })

  var PodsDB = mongoose.model('pods', podsSchema)

  // ----------- Connection -----------

  mongoose.connect('mongodb://' + host + ':' + port + '/' + dbname)
  mongoose.connection.on('error', function () {
    logger.error('Mongodb connection error.')
    process.exit(0)
  })

  mongoose.connection.on('open', function () {
    logger.info('Connected to mongodb.')
  })

  // ----------- Export -----------
  module.exports = {
    VideosDB: VideosDB,
    PodsDB: PodsDB
  }
})()
