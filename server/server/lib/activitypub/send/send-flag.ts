import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityFlag } from '@peertube/peertube-models'
import { logger } from '../../../helpers/logger.js'
import { MAbuseAP, MAccountLight, MActor } from '../../../types/models/index.js'
import { audiencify, getAudience } from '../audience.js'
import { getLocalAbuseActivityPubUrl } from '../url.js'
import { unicastTo } from './shared/send-utils.js'

function sendAbuse (byActor: MActor, abuse: MAbuseAP, flaggedAccount: MAccountLight, t: Transaction) {
  if (!flaggedAccount.Actor.serverId) return // Local user

  const url = getLocalAbuseActivityPubUrl(abuse)

  logger.info('Creating job to send abuse %s.', url)

  // Custom audience, we only send the abuse to the origin instance
  const audience = { to: [ flaggedAccount.Actor.url ], cc: [] }
  const flagActivity = buildFlagActivity(url, byActor, abuse, audience)

  return t.afterCommit(() => {
    return unicastTo({
      data: flagActivity,
      byActor,
      toActorUrl: flaggedAccount.Actor.getSharedInbox(),
      contextType: 'Flag'
    })
  })
}

function buildFlagActivity (url: string, byActor: MActor, abuse: MAbuseAP, audience: ActivityAudience): ActivityFlag {
  if (!audience) audience = getAudience(byActor)

  const activity = { id: url, actor: byActor.url, ...abuse.toActivityPubObject() }

  return audiencify(activity, audience)
}

// ---------------------------------------------------------------------------

export {
  sendAbuse
}
