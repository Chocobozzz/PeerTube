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
  .then(async videos => {
    for (const video of videos) {
      for (const file of video.VideoFiles) {
        await video.createTorrentAndSetInfoHash(file)
        console.log('Updated video ' + video.uuid)
      }
    }
  })
  .then(() => {
    process.exit(0)
  })
