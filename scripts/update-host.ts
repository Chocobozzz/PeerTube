import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
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
    videos.forEach(video => {
      video.VideoFiles.forEach(file => {
        video.createTorrentAndSetInfoHash(file)
      })
    })

    process.exit(0)
  })
