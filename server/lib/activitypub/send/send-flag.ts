import { ActorModel } from '../../../models/activitypub/actor'
import { VideoModel } from '../../../models/video/video'
import { VideoAbuseModel } from '../../../models/video/video-abuse'
import { getVideoAbuseActivityPubUrl } from '../url'
import { unicastTo } from './utils'
import { logger } from '../../../helpers/logger'
import { ActivityAudience, ActivityFlag } from '../../../../shared/models/activitypub'
import { audiencify, getAudience } from '../audience'
import { Transaction } from 'sequelize'

async function sendVideoAbuse (byActor: ActorModel, videoAbuse: VideoAbuseModel, video: VideoModel, t: Transaction) {
  if (!video.VideoChannel.Account.Actor.serverId) return // Local user

  const url = getVideoAbuseActivityPubUrl(videoAbuse)

  logger.info('Creating job to send video abuse %s.', url)

  // Custom audience, we only send the abuse to the origin instance
  const audience = { to: [ video.VideoChannel.Account.Actor.url ], cc: [] }
  const flagActivity = buildFlagActivity(url, byActor, videoAbuse, audience)

  t.afterCommit(() => unicastTo(flagActivity, byActor, video.VideoChannel.Account.Actor.sharedInboxUrl))
}

function buildFlagActivity (url: string, byActor: ActorModel, videoAbuse: VideoAbuseModel, audience: ActivityAudience): ActivityFlag {
  if (!audience) audience = getAudience(byActor)

  const activity = Object.assign(
    { id: url, actor: byActor.url },
    videoAbuse.toActivityPubObject()
  )

  return audiencify(activity, audience)
}

// ---------------------------------------------------------------------------

export {
  sendVideoAbuse
}
