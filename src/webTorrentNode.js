;(function () {
  'use strict'

  var spawn = require('electron-spawn')
  var config = require('config')
  var ipc = require('node-ipc')
  var pathUtils = require('path')

  var logger = require('./logger')

  var host
  var port

  try {
    host = config.get('webserver.host')
    port = config.get('webserver.port')
  } catch (e) {
    host = 'client'
    port = 1
  }

  var nodeKey = 'webtorrentnode' + port
  var processKey = 'webtorrent' + port

  ipc.config.silent = true
  ipc.config.id = nodeKey

  var webtorrentnode = {}

  // Useful for beautiful tests
  webtorrentnode.silent = false

  // Useful to kill it
  webtorrentnode.app = null

  webtorrentnode.create = function (callback) {
    ipc.serve(function () {
      if (!webtorrentnode.silent) logger.info('IPC server ready.')

      ipc.server.on(processKey + '.ready', function () {
        if (!webtorrentnode.silent) logger.info('Webtorrent process ready.')
        callback()
      })

      var webtorrent_process = spawn(__dirname + '/webtorrent.js', host, port, { detached: true })
      webtorrent_process.stderr.on('data', function (data) {
        // logger.debug('Webtorrent process stderr: ', data.toString())
      })

      webtorrent_process.stdout.on('data', function (data) {
        // logger.debug('Webtorrent process:', data.toString())
      })

      function exitChildProcess () {
        if (!webtorrentnode.silent) logger.info('Gracefully exit child')
        process.kill(-webtorrent_process.pid)
        process.exit(0)
      }

      process.on('SIGINT', exitChildProcess)
      process.on('SIGTERM', exitChildProcess)

      webtorrentnode.app = webtorrent_process
    })

    ipc.server.start()
  }

  webtorrentnode.seed = function (path, callback) {
    var extension = pathUtils.extname(path)
    var basename = pathUtils.basename(path, extension)
    var data = {
      _id: basename,
      args: {
        path: path
      }
    }

    if (!webtorrentnode.silent) logger.debug('Node wants to seed ' + data._id)

    // Finish signal
    ipc.server.on(nodeKey + '.seedDone.' + data._id, function (received) {
      if (!webtorrentnode.silent) logger.debug('Process seeded torrent ' + received.magnetUri)

      // This is a fake object, we just use the magnetUri in this project
      var torrent = {
        magnetURI: received.magnetUri
      }

      callback(torrent)
    })

    ipc.server.broadcast(processKey + '.seed', data)
  }

  webtorrentnode.add = function (magnetUri, callback) {
    var data = {
      _id: magnetUri,
      args: {
        magnetUri: magnetUri
      }
    }

    if (!webtorrentnode.silent) logger.debug('Node wants to add ' + data._id)

    // Finish signal
    ipc.server.on(nodeKey + '.addDone.' + data._id, function (received) {
      if (!webtorrentnode.silent) logger.debug('Process added torrent')

      // This is a fake object, we just use the magnetUri in this project
      var torrent = {
        files: received.files
      }

      callback(torrent)
    })

    ipc.server.broadcast(processKey + '.add', data)
  }

  webtorrentnode.remove = function (magnetUri, callback) {
    var data = {
      _id: magnetUri,
      args: {
        magnetUri: magnetUri
      }
    }

    if (!webtorrentnode.silent) logger.debug('Node wants to stop seeding ' + data._id)

    // Finish signal
    ipc.server.on(nodeKey + '.removeDone.' + data._id, function (received) {
      if (!webtorrentnode.silent) logger.debug('Process removed torrent ' + data._id)

      var err = null
      if (received.err) err = received.err

      callback(err)
    })

    ipc.server.broadcast(processKey + '.remove', data)
  }

  module.exports = webtorrentnode
})()
