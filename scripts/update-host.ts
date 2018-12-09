import { CONFIG, initDatabaseModels } from '../server/initializers'
import { ActorFollowModel } from '../server/models/activitypub/actor-follow'
import { VideoModel } from '../server/models/video/video'
import { ActorModel } from '../server/models/activitypub/actor'
import {
  getAccountActivityPubUrl,
  getVideoAnnounceActivityPubUrl,
  getVideoActivityPubUrl, getVideoChannelActivityPubUrl,
  getVideoCommentActivityPubUrl
} from '../server/lib/activitypub'
import { VideoShareModel } from '../server/models/video/video-share'
import { VideoCommentModel } from '../server/models/video/video-comment'
import { getServerActor } from '../server/helpers/utils'
import { AccountModel } from '../server/models/account/account'
import { VideoChannelModel } from '../server/models/video/video-channel'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  await initDatabaseModels(true)

  const serverAccount = await getServerActor()

  {
    const res = await ActorFollowModel.listAcceptedFollowingUrlsForApi([ serverAccount.id ], undefined)
    const hasFollowing = res.total > 0

    if (hasFollowing === true) {
      throw new Error('Cannot update host because you follow other servers!')
    }
  }

  console.log('Updating actors.')

  const actors: ActorModel[] = await ActorModel.unscoped().findAll({
    include: [
      {
        model: VideoChannelModel.unscoped(),
        required: false
      },
      {
        model: AccountModel.unscoped(),
        required: false
      }
    ]
  })
  for (const actor of actors) {
    if (actor.isOwned() === false) continue

    console.log('Updating actor ' + actor.url)

    const newUrl = actor.Account
      ? getAccountActivityPubUrl(actor.preferredUsername)
      : getVideoChannelActivityPubUrl(actor.preferredUsername)

    actor.url = newUrl
    actor.inboxUrl = newUrl + '/inbox'
    actor.outboxUrl = newUrl + '/outbox'
    actor.sharedInboxUrl = CONFIG.WEBSERVER.URL + '/inbox'
    actor.followersUrl = newUrl + '/followers'
    actor.followingUrl = newUrl + '/following'

    await actor.save()
  }

  console.log('Updating video shares.')

  const videoShares: VideoShareModel[] = await VideoShareModel.findAll({
    include: [ VideoModel.unscoped(), ActorModel.unscoped() ]
  })
  for (const videoShare of videoShares) {
    if (videoShare.Video.isOwned() === false) continue

    console.log('Updating video share ' + videoShare.url)

    videoShare.url = getVideoAnnounceActivityPubUrl(videoShare.Actor, videoShare.Video)
    await videoShare.save()
  }

  console.log('Updating video comments.')
  const videoComments: VideoCommentModel[] = await VideoCommentModel.findAll({
    include: [
      {
        model: VideoModel.unscoped()
      },
      {
        model: AccountModel.unscoped(),
        include: [
          {
            model: ActorModel.unscoped()
          }
        ]
      }
    ]
  })
  for (const comment of videoComments) {
    if (comment.isOwned() === false) continue

    console.log('Updating comment ' + comment.url)

    comment.url = getVideoCommentActivityPubUrl(comment.Video, comment)
    await comment.save()
  }

  console.log('Updating video and torrent files.')

  const videos = await VideoModel.list()
  for (const video of videos) {
    if (video.isOwned() === false) continue

    console.log('Updated video ' + video.uuid)

    video.url = getVideoActivityPubUrl(video)
    await video.save()

    for (const file of video.VideoFiles) {
      console.log('Updating torrent file %s of video %s.', file.resolution, video.uuid)
      await video.createTorrentAndSetInfoHash(file)
    }
  }
}
