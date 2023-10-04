import { ActivityFollow, ActivityReject } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { MActor } from '../../../types/models/index.js'
import { getLocalActorFollowRejectActivityPubUrl } from '../url.js'
import { buildFollowActivity } from './send-follow.js'
import { unicastTo } from './shared/send-utils.js'

function sendReject (followUrl: string, follower: MActor, following: MActor) {
  if (!follower.serverId) { // This should never happen
    logger.warn('Do not sending reject to local follower.')
    return
  }

  logger.info('Creating job to reject follower %s.', follower.url)

  const followData = buildFollowActivity(followUrl, follower, following)

  const url = getLocalActorFollowRejectActivityPubUrl()
  const data = buildRejectActivity(url, following, followData)

  return unicastTo({ data, byActor: following, toActorUrl: follower.inboxUrl, contextType: 'Reject' })
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
