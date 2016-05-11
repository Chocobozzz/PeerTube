'use strict'

const WebTorrent = require('webtorrent')
const ipc = require('node-ipc')

function webtorrent (args) {
  if (args.length !== 3) {
    throw new Error('Wrong arguments number: ' + args.length + '/3')
  }

  const host = args[1]
  const port = args[2]
  const nodeKey = 'webtorrentnode' + port
  const processKey = 'webtorrentprocess' + port

  ipc.config.silent = true
  ipc.config.id = processKey

  if (host === 'client' && port === '1') global.WEBTORRENT_ANNOUNCE = []
  else global.WEBTORRENT_ANNOUNCE = 'ws://' + host + ':' + port + '/tracker/socket'
  const wt = new WebTorrent({ dht: false })

  function seed (data) {
    const args = data.args
    const path = args.path
    const _id = data._id

    wt.seed(path, { announceList: '' }, function (torrent) {
      const toSend = {
        magnetUri: torrent.magnetURI
      }

      ipc.of[nodeKey].emit(nodeKey + '.seedDone.' + _id, toSend)
    })
  }

  function add (data) {
    const args = data.args
    const magnetUri = args.magnetUri
    const _id = data._id

    wt.add(magnetUri, function (torrent) {
      const toSend = {
        files: []
      }

      torrent.files.forEach(function (file) {
        toSend.files.push({ path: file.path })
      })

      ipc.of[nodeKey].emit(nodeKey + '.addDone.' + _id, toSend)
    })
  }

  function remove (data) {
    const args = data.args
    const magnetUri = args.magnetUri
    const _id = data._id

    try {
      wt.remove(magnetUri, callback)
    } catch (err) {
      console.log('Cannot remove the torrent from WebTorrent.')
      return callback(null)
    }

    function callback () {
      const toSend = {}
      ipc.of[nodeKey].emit(nodeKey + '.removeDone.' + _id, toSend)
    }
  }

  console.log('Configuration: ' + host + ':' + port)
  console.log('Connecting to IPC...')

  ipc.connectTo(nodeKey, function () {
    ipc.of[nodeKey].on(processKey + '.seed', seed)
    ipc.of[nodeKey].on(processKey + '.add', add)
    ipc.of[nodeKey].on(processKey + '.remove', remove)

    ipc.of[nodeKey].emit(processKey + '.ready')
    console.log('Ready.')
  })

  process.on('uncaughtException', function (e) {
    ipc.of[nodeKey].emit(processKey + '.exception', { exception: e.toString() })
  })
}

// ---------------------------------------------------------------------------

module.exports = webtorrent
