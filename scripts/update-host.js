#!/usr/bin/env node

'use strict'

// TODO: document this script

const fs = require('fs')
const parseTorrent = require('parse-torrent')

const constants = require('../server/initializers/constants')
const db = require('../server/initializers/database')

const friends = require('../server/lib/friends')

db.init(true, function () {
  friends.hasFriends(function (err, hasFriends) {
    if (err) throw err

    if (hasFriends === true) {
      console.log('Cannot update host because you have friends!')
      process.exit(-1)
    }

    console.log('Updating torrent files.')
    db.Video.list(function (err, videos) {
      if (err) throw err

      videos.forEach(function (video) {
        const torrentName = video._id + '.torrent'
        const torrentPath = constants.CONFIG.STORAGE.TORRENTS_DIR + torrentName
        const filename = video._id + video.extname

        const parsed = parseTorrent(fs.readFileSync(torrentPath))
        parsed.announce = [ constants.CONFIG.WEBSERVER.WS + '://' + constants.CONFIG.WEBSERVER.HOST + '/tracker/socket' ]
        parsed.urlList = [ constants.CONFIG.WEBSERVER.URL + constants.STATIC_PATHS.WEBSEED + filename ]

        const buf = parseTorrent.toTorrentFile(parsed)
        fs.writeFileSync(torrentPath, buf)
      })

      process.exit(0)
    })
  })
})
