import * as Promise from 'bluebird'

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
    const tasks: Promise<any>[] = []

    videos.forEach(video => {
      console.log('Updating video ' + video.uuid)

      video.VideoFiles.forEach(file => {
        tasks.push(video.createTorrentAndSetInfoHash(file))
      })
    })

    return Promise.all(tasks)
  })
  .then(() => {
    process.exit(0)
  })
