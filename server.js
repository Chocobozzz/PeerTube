;(function () {
  'use strict'

  // ----------- Node modules -----------
  var express = require('express')
  var path = require('path')
  var morgan = require('morgan')
  var bodyParser = require('body-parser')
  var multer = require('multer')
  var TrackerServer = require('bittorrent-tracker').Server
  var WebSocketServer = require('ws').Server
  var app = express()
  var http = require('http')

  // ----------- Checker -----------
  var checker = require('./src/checker')

  var miss = checker.checkConfig()
  if (miss.length !== 0) {
    // Do not use logger module
    console.error('Miss some configurations keys.', { miss: miss })
    process.exit(0)
  }

  checker.createDirectories()

  // ----------- PeerTube modules -----------
  var config = require('config')
  var logger = require('./src/logger')
  var routes = require('./routes')
  var api = require('./routes/api')
  var utils = require('./src/utils')
  var videos = require('./src/videos')
  var webtorrent = require('./src/webTorrentNode')

  var compression
  var port = config.get('listen.port')
  var uploads = config.get('storage.uploads')

  // ----------- Command line -----------

  // ----------- App -----------
  app.use(morgan('combined', { stream: logger.stream }))
  app.use(bodyParser.json())
  app.use(multer({ dest: uploads }))
  app.use(bodyParser.urlencoded({ extended: false }))

  // ----------- Views, routes and static files -----------

  if (process.env.NODE_ENV === 'production') {
    // logger.log('Production : static files in dist/\n')

    // GZip compression
    compression = require('compression')
    app.use(compression())

    // A month
    var maxAge = 86400000 * 30

    // TODO
    app.get(/^\/(index|(partials\/[a-z\/]+))?$/, function (req, res, next) {
      if (req.url === '/') {
        req.url = '/index'
      }

      req.url += '.html'
      next()
    })

    app.use(express.static(path.join(__dirname, '/dist/public'), { maxAge: maxAge }))
    app.use(express.static(path.join(__dirname, '/dist/views'), { maxAge: maxAge }))
  } else {
    // Livereload
    app.use(require('connect-livereload')({
      port: 35729
    }))

    require('segfault-handler').registerHandler()

    app.use(express.static(path.join(__dirname, '/public'), { maxAge: 0 }))

    // Jade template from ./views directory
    app.set('views', path.join(__dirname, '/views'))
    app.set('view engine', 'jade')

    // Views routes
    app.use('/', routes)
  }

  // ----------- Routes -----------
  app.use('/api/videos', api.videos)
  app.use('/api/remotevideos', api.remoteVideos)
  app.use('/api/pods', api.pods)

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
