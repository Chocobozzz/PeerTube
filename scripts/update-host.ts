import { readFileSync, writeFileSync } from 'fs'
import * as parseTorrent from 'parse-torrent'

import { CONFIG, STATIC_PATHS } from '../server/initializers/constants'
import { database as db } from '../server/initializers/database'
import { hasFriends } from '../server/lib/friends'

db.init(true)
  .then(() => {
    return hasFriends()
  })
  .then(itHasFriends => {
    if (itHasFriends === true) {
      console.log('Cannot update host because you have friends!')
      process.exit(-1)
    }

    console.log('Updating torrent files.')
    return db.Video.list()
  })
  .then(videos => {
    videos.forEach(function (video) {
      const torrentName = video.id + '.torrent'
      const torrentPath = CONFIG.STORAGE.TORRENTS_DIR + torrentName
      const filename = video.id + video.extname

      const parsed = parseTorrent(readFileSync(torrentPath))
      parsed.announce = [ CONFIG.WEBSERVER.WS + '://' + CONFIG.WEBSERVER.HOST + '/tracker/socket' ]
      parsed.urlList = [ CONFIG.WEBSERVER.URL + STATIC_PATHS.WEBSEED + filename ]

      const buf = parseTorrent.toTorrentFile(parsed)
      writeFileSync(torrentPath, buf)
    })

    process.exit(0)
  })
