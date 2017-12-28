import { getServerActor } from '../server/helpers/utils'
import { initDatabaseModels } from '../server/initializers'
import { ActorFollowModel } from '../server/models/activitypub/actor-follow'
import { VideoModel } from '../server/models/video/video'

initDatabaseModels(true)
  .then(() => {
    return getServerActor()
  })
  .then(serverAccount => {
    return ActorFollowModel.listAcceptedFollowingUrlsForApi([ serverAccount.id ], undefined)
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
    return VideoModel.list()
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
