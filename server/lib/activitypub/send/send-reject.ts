import { ActivityFollow, ActivityReject } from '../../../../shared/models/activitypub'
import { logger } from '../../../helpers/logger'
import { MActor } from '../../../types/models'
import { getLocalActorFollowRejectActivityPubUrl } from '../url'
import { buildFollowActivity } from './send-follow'
import { unicastTo } from './utils'

function sendReject (followUrl: string, follower: MActor, following: MActor) {
  if (!follower.serverId) { // This should never happen
    logger.warn('Do not sending reject to local follower.')
    return
  }

  logger.info('Creating job to reject follower %s.', follower.url)

  const followData = buildFollowActivity(followUrl, follower, following)

  const url = getLocalActorFollowRejectActivityPubUrl(follower, following)
  const data = buildRejectActivity(url, following, followData)

  return unicastTo(data, following, follower.inboxUrl)
}

// ---------------------------------------------------------------------------

export {
  sendReject
}

// ---------------------------------------------------------------------------

function buildRejectActivity (url: string, byActor: MActor, followActivityData: ActivityFollow): ActivityReject {
  return {
    type: 'Reject',
    id: url,
    actor: byActor.url,
    object: followActivityData
  }
}
