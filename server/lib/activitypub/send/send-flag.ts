import { getVideoAbuseActivityPubUrl } from '../url'
import { unicastTo } from './utils'
import { logger } from '../../../helpers/logger'
import { ActivityAudience, ActivityFlag } from '../../../../shared/models/activitypub'
import { audiencify, getAudience } from '../audience'
import { Transaction } from 'sequelize'
import { MActor, MVideoFullLight } from '../../../typings/models'
import { MVideoAbuseVideo } from '../../../typings/models/video'

function sendVideoAbuse (byActor: MActor, videoAbuse: MVideoAbuseVideo, video: MVideoFullLight, t: Transaction) {
  if (!video.VideoChannel.Account.Actor.serverId) return // Local user

  const url = getVideoAbuseActivityPubUrl(videoAbuse)

  logger.info('Creating job to send video abuse %s.', url)

  // Custom audience, we only send the abuse to the origin instance
  const audience = { to: [ video.VideoChannel.Account.Actor.url ], cc: [] }
  const flagActivity = buildFlagActivity(url, byActor, videoAbuse, audience)

  t.afterCommit(() => unicastTo(flagActivity, byActor, video.VideoChannel.Account.Actor.getSharedInbox()))
}

function buildFlagActivity (url: string, byActor: MActor, videoAbuse: MVideoAbuseVideo, audience: ActivityAudience): ActivityFlag {
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
