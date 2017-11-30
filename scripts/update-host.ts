import { database as db } from '../server/initializers/database'
import { getServerAccount } from '../server/helpers/utils'

db.init(true)
  .then(() => {
    return getServerAccount()
  })
  .then(serverAccount => {
    return db.AccountFollow.listAcceptedFollowingUrlsForApi([ serverAccount.id ], undefined)
  })
  .then(res => {
    return res.total > 0
  })
  .then(hasFollowing => {
    if (hasFollowing === true) {
      console.log('Cannot update host because you follow other servers!')
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
