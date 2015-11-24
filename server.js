;(function () {
  'use strict'

  // ----------- Node modules -----------
  var bodyParser = require('body-parser')
  var express = require('express')
  var expressValidator = require('express-validator')
  var http = require('http')
  var morgan = require('morgan')
  var multer = require('multer')
  var path = require('path')
  var TrackerServer = require('bittorrent-tracker').Server
  var WebSocketServer = require('ws').Server

  // Create our main app
  var app = express()

  // ----------- Checker -----------
  var checker = require('./src/checker')

  var miss = checker.checkConfig()
  if (miss.length !== 0) {
    // Do not use logger module
    console.error('Miss some configurations keys.', { miss: miss })
    process.exit(0)
  }

  checker.createDirectoriesIfNotExist()

  // ----------- Constants -----------
  var utils = require('./src/utils')

  global.API_VERSION = 'v1'
  global.FRIEND_BASE_SCORE = utils.isTestInstance() ? 20 : 100

  // ----------- PeerTube modules -----------
  var config = require('config')
  var logger = require('./src/logger')
  var routes = require('./routes')
  var videos = require('./src/videos')
  var webtorrent = require('./src/webTorrentNode')

  // Get configurations
  var port = config.get('listen.port')
  var uploads = config.get('storage.uploads')

  // ----------- Command line -----------

  // ----------- App -----------

  // For the logger
  app.use(morgan('combined', { stream: logger.stream }))
  // For body requests
  app.use(bodyParser.json())
  // For POST file requests
  app.use(multer({ dest: uploads }))
  app.use(bodyParser.urlencoded({ extended: false }))
  // Validate some params for the API
  app.use(expressValidator())

  // ----------- Views, routes and static files -----------

  // Livereload
  app.use(require('connect-livereload')({
    port: 35729
  }))

  // Catch sefaults
  require('segfault-handler').registerHandler()

  // Static files
  app.use(express.static(path.join(__dirname, '/public'), { maxAge: 0 }))

  // Jade template from ./views directory
  app.set('views', path.join(__dirname, '/views'))
  app.set('view engine', 'jade')

  // API routes
  var api_route = '/api/' + global.API_VERSION
  app.use(api_route, routes.api)

  // Views routes
  app.use('/', routes.views)

  // ----------- Tracker -----------

  var trackerServer = new TrackerServer({
    http: false,
    udp: false,
    ws: false,
    dht: false
  })

  trackerServer.on('error', function (err) {
    logger.error(err)
  })

  trackerServer.on('warning', function (err) {
    logger.error(err)
  })

  var server = http.createServer(app)
  var wss = new WebSocketServer({server: server, path: '/tracker/socket'})
  wss.on('connection', function (ws) {
    trackerServer.onWebSocketConnection(ws)
  })

  // ----------- Errors -----------

  // Catch 404 and forward to error handler
  app.use(function (req, res, next) {
    var err = new Error('Not Found')
    err.status = 404
    next(err)
  })

  // Prod : no stacktraces leaked to user
  if (process.env.NODE_ENV === 'production') {
    app.use(function (err, req, res, next) {
      logger.error('Error : ' + err.message, { error: err })
      res.status(err.status || 500)
      res.render('error', {
        message: err.message,
        error: {}
      })
    })
  } else {
    app.use(function (err, req, res, next) {
      logger.error('Error : ' + err.message, { error: err })
      res.status(err.status || 500)
      res.render('error', {
        message: err.message,
        error: err
      })
    })
  }

  // ----------- Create the certificates if they don't already exist -----------
  utils.createCertsIfNotExist(function (err) {
    if (err) throw err
    // Create/activate the webtorrent module
    webtorrent.create(function () {
      function cleanForExit () {
        utils.cleanForExit(webtorrent.app)
      }

      function exitGracefullyOnSignal () {
        process.exit()
      }

      process.on('exit', cleanForExit)
      process.on('SIGINT', exitGracefullyOnSignal)
      process.on('SIGTERM', exitGracefullyOnSignal)

      // ----------- Make the server listening -----------
      server.listen(port, function () {
        videos.seedAll(function () {
          logger.info('Seeded all the videos')
          logger.info('Server listening on port %d', port)
          app.emit('ready')
        })
      })
    })
  })

  module.exports = app
})()
