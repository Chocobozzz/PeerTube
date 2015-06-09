;(function () {
  'use strict'

  module.exports = function (args) {
    var WebTorrent = require('webtorrent')
    var ipc = require('node-ipc')

    if (args.length !== 3) {
      console.log('Wrong arguments number: ' + args.length + '/3')
      process.exit(-1)
    }

    var host = args[1]
    var port = args[2]
    var nodeKey = 'webtorrentnode' + port
    var processKey = 'webtorrent' + port

    ipc.config.silent = true
    ipc.config.id = processKey

    if (host === 'client' && port === '1') global.WEBTORRENT_ANNOUNCE = []
    else global.WEBTORRENT_ANNOUNCE = 'ws://' + host + ':' + port + '/tracker/socket'
    var wt = new WebTorrent({ dht: false })

    function seed (data) {
      var args = data.args
      var path = args.path
      var _id = data._id

      wt.seed(path, function (torrent) {
        var to_send = {
          magnetUri: torrent.magnetURI
        }

        ipc.of[nodeKey].emit(nodeKey + '.seedDone.' + _id, to_send)
      })
    }

    function add (data) {
      var args = data.args
      var magnetUri = args.magnetUri
      var _id = data._id

      wt.add(magnetUri, function (torrent) {
        var to_send = {
          files: []
        }

        torrent.files.forEach(function (file) {
          to_send.files.push({ path: file.path })
        })

        ipc.of[nodeKey].emit(nodeKey + '.addDone.' + _id, to_send)
      })
    }

    function remove (data) {
      var args = data.args
      var magnetUri = args.magnetUri
      var _id = data._id

      try {
        wt.remove(magnetUri, callback)
      } catch (err) {
        console.log('Cannot remove the torrent from WebTorrent', { err: err })
        return callback(null)
      }

      function callback () {
        var to_send = {}
        ipc.of[nodeKey].emit(nodeKey + '.removeDone.' + _id, to_send)
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
  }
})()
