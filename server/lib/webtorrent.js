'use strict'

const config = require('config')
const ipc = require('node-ipc')
const pathUtils = require('path')
const spawn = require('electron-spawn')

const logger = require('../helpers/logger')

const electronDebug = config.get('electron.debug')
let host = config.get('webserver.host')
let port = config.get('webserver.port')
let nodeKey = 'webtorrentnode' + port
let processKey = 'webtorrentprocess' + port
ipc.config.silent = true
ipc.config.id = nodeKey

const webtorrent = {
  add: add,
  app: null, // Pid of the app
  create: create,
  remove: remove,
  seed: seed,
  silent: false // Useful for beautiful tests
}

function create (options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }

  // Override options
  if (options.host) host = options.host
  if (options.port) {
    port = options.port
    nodeKey = 'webtorrentnode' + port
    processKey = 'webtorrentprocess' + port
    ipc.config.id = nodeKey
  }

  ipc.serve(function () {
    if (!webtorrent.silent) logger.info('IPC server ready.')

    // Run a timeout of 30s after which we exit the process
    const timeoutWebtorrentProcess = setTimeout(function () {
      throw new Error('Timeout : cannot run the webtorrent process. Please ensure you have electron-prebuilt npm package installed with xvfb-run.')
    }, 30000)

    ipc.server.on(processKey + '.ready', function () {
      if (!webtorrent.silent) logger.info('Webtorrent process ready.')
      clearTimeout(timeoutWebtorrentProcess)
      callback()
    })

    ipc.server.on(processKey + '.exception', function (data) {
      throw new Error('Received exception error from webtorrent process : ' + data.exception)
    })

    const webtorrentProcess = spawn(pathUtils.join(__dirname, 'webtorrent-process.js'), host, port, { detached: true })

    if (electronDebug === true) {
      webtorrentProcess.stderr.on('data', function (data) {
        logger.debug('Webtorrent process stderr: ', data.toString())
      })

      webtorrentProcess.stdout.on('data', function (data) {
        logger.debug('Webtorrent process:', data.toString())
      })
    }

    webtorrent.app = webtorrentProcess
  })

  ipc.server.start()
}

function seed (path, callback) {
  const extension = pathUtils.extname(path)
  const basename = pathUtils.basename(path, extension)
  const data = {
    _id: basename,
    args: {
      path: path
    }
  }

  if (!webtorrent.silent) logger.debug('Node wants to seed %s.', data._id)

  // Finish signal
  const eventKey = nodeKey + '.seedDone.' + data._id
  ipc.server.on(eventKey, function listener (received) {
    if (!webtorrent.silent) logger.debug('Process seeded torrent %s.', received.magnetUri)

    // This is a fake object, we just use the magnetUri in this project
    const torrent = {
      magnetURI: received.magnetUri
    }

    ipc.server.off(eventKey)
    callback(torrent)
  })

  ipc.server.broadcast(processKey + '.seed', data)
}

function add (magnetUri, callback) {
  const data = {
    _id: magnetUri,
    args: {
      magnetUri: magnetUri
    }
  }

  if (!webtorrent.silent) logger.debug('Node wants to add ' + data._id)

  // Finish signal
  const eventKey = nodeKey + '.addDone.' + data._id
  ipc.server.on(eventKey, function (received) {
    if (!webtorrent.silent) logger.debug('Process added torrent.')

    // This is a fake object, we just use the magnetUri in this project
    const torrent = {
      files: received.files
    }

    ipc.server.off(eventKey)
    callback(torrent)
  })

  ipc.server.broadcast(processKey + '.add', data)
}

function remove (magnetUri, callback) {
  const data = {
    _id: magnetUri,
    args: {
      magnetUri: magnetUri
    }
  }

  if (!webtorrent.silent) logger.debug('Node wants to stop seeding %s.', data._id)

  // Finish signal
  const eventKey = nodeKey + '.removeDone.' + data._id
  ipc.server.on(eventKey, function (received) {
    if (!webtorrent.silent) logger.debug('Process removed torrent %s.', data._id)

    let err = null
    if (received.err) err = received.err

    ipc.server.off(eventKey)
    callback(err)
  })

  ipc.server.broadcast(processKey + '.remove', data)
}

// ---------------------------------------------------------------------------

module.exports = webtorrent
