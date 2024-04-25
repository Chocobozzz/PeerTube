import { Transaction } from 'sequelize'
import { Activity, ActivityAudience, ActivitypubHttpBroadcastPayload, ContextType } from '@peertube/peertube-models'
import { ActorFollowHealthCache } from '@server/lib/actor-follow-health-cache.js'
import { getServerActor } from '@server/models/application/application.js'
import { afterCommitIfTransaction } from '../../../../helpers/database-utils.js'
import { logger } from '../../../../helpers/logger.js'
import { ActorFollowModel } from '../../../../models/actor/actor-follow.js'
import { ActorModel } from '../../../../models/actor/actor.js'
import {
  MActor,
  MActorId,
  MActorLight,
  MActorWithInboxes,
  MVideoAccountLight,
  MVideoId,
  MVideoImmutable
} from '../../../../types/models/index.js'
import { JobQueue } from '../../../job-queue/index.js'
import { getActorsInvolvedInVideo, getAudienceFromFollowersOf, getOriginVideoAudience } from './audience-utils.js'

async function sendVideoRelatedActivity (activityBuilder: (audience: ActivityAudience) => Activity, options: {
  byActor: MActorLight
  video: MVideoImmutable | MVideoAccountLight
  contextType: ContextType
  parallelizable?: boolean
  transaction?: Transaction
}) {
  const { byActor, video, transaction, contextType, parallelizable } = options

  // Send to origin
  if (video.isOwned() === false) {
    return sendVideoActivityToOrigin(activityBuilder, options)
  }

  const actorsInvolvedInVideo = await getActorsInvolvedInVideo(video, transaction)

  // Send to followers
  const audience = getAudienceFromFollowersOf(actorsInvolvedInVideo)
  const activity = activityBuilder(audience)

  const actorsException = [ byActor ]

  return broadcastToFollowers({
    data: activity,
    byActor,
    toFollowersOf: actorsInvolvedInVideo,
    transaction,
    actorsException,
    parallelizable,
    contextType
  })
}

async function sendVideoActivityToOrigin (activityBuilder: (audience: ActivityAudience) => Activity, options: {
  byActor: MActorLight
  video: MVideoImmutable | MVideoAccountLight
  contextType: ContextType

  actorsInvolvedInVideo?: MActorLight[]
  transaction?: Transaction
}) {
  const { byActor, video, actorsInvolvedInVideo, transaction, contextType } = options

  if (video.isOwned()) throw new Error('Cannot send activity to owned video origin ' + video.url)

  let accountActor: MActorLight = (video as MVideoAccountLight).VideoChannel?.Account?.Actor
  if (!accountActor) accountActor = await ActorModel.loadAccountActorByVideoId(video.id, transaction)

  const audience = getOriginVideoAudience(accountActor, actorsInvolvedInVideo)
  const activity = activityBuilder(audience)

  return afterCommitIfTransaction(transaction, () => {
    return unicastTo({
      data: activity,
      byActor,
      toActorUrl: accountActor.getSharedInbox(),
      contextType
    })
  })
}

// ---------------------------------------------------------------------------

async function forwardVideoRelatedActivity (
  activity: Activity,
  t: Transaction,
  followersException: MActorWithInboxes[],
  video: MVideoId
) {
  // Mastodon does not add our announces in audience, so we forward to them manually
  const additionalActors = await getActorsInvolvedInVideo(video, t)
  const additionalFollowerUrls = additionalActors.map(a => a.followersUrl)

  return forwardActivity(activity, t, followersException, additionalFollowerUrls)
}

async function forwardActivity (
  activity: Activity,
  t: Transaction,
  followersException: MActorWithInboxes[] = [],
  additionalFollowerUrls: string[] = []
) {
  logger.info('Forwarding activity %s.', activity.id)

  const to = activity.to || []
  const cc = activity.cc || []

  const followersUrls = additionalFollowerUrls
  for (const dest of to.concat(cc)) {
    if (dest.endsWith('/followers')) {
      followersUrls.push(dest)
    }
  }

  const toActorFollowers = await ActorModel.listByFollowersUrls(followersUrls, t)
  const uris = await computeFollowerUris(toActorFollowers, followersException, t)

  if (uris.length === 0) {
    logger.info('0 followers for %s, no forwarding.', toActorFollowers.map(a => a.id).join(', '))
    return undefined
  }

  logger.debug('Creating forwarding job.', { uris })

  const payload: ActivitypubHttpBroadcastPayload = {
    uris,
    body: activity,
    contextType: null
  }
  return afterCommitIfTransaction(t, () => JobQueue.Instance.createJobAsync({ type: 'activitypub-http-broadcast', payload }))
}

// ---------------------------------------------------------------------------

async function broadcastToFollowers (options: {
  data: any
  byActor: MActorId
  toFollowersOf: MActorId[]
  transaction: Transaction
  contextType: ContextType

  parallelizable?: boolean
  actorsException?: MActorWithInboxes[]
}) {
  const { data, byActor, toFollowersOf, transaction, contextType, actorsException = [], parallelizable } = options

  const uris = await computeFollowerUris(toFollowersOf, actorsException, transaction)

  return afterCommitIfTransaction(transaction, () => {
    return broadcastTo({
      uris,
      data,
      byActor,
      parallelizable,
      contextType
    })
  })
}

async function broadcastToActors (options: {
  data: any
  byActor: MActorId
  toActors: MActor[]
  transaction: Transaction
  contextType: ContextType
  actorsException?: MActorWithInboxes[]
}) {
  const { data, byActor, toActors, transaction, contextType, actorsException = [] } = options

  const uris = await computeUris(toActors, actorsException)

  return afterCommitIfTransaction(transaction, () => {
    return broadcastTo({
      uris,
      data,
      byActor,
      contextType
    })
  })
}

function broadcastTo (options: {
  uris: string[]
  data: any
  byActor: MActorId
  contextType: ContextType
  parallelizable?: boolean // default to false
}) {
  const { uris, data, byActor, contextType, parallelizable } = options

  if (uris.length === 0) return undefined

  const broadcastUris: string[] = []
  const unicastUris: string[] = []

  // Bad URIs could be slow to respond, prefer to process them in a dedicated queue
  for (const uri of uris) {
    if (ActorFollowHealthCache.Instance.isBadInbox(uri)) {
      unicastUris.push(uri)
    } else {
      broadcastUris.push(uri)
    }
  }

  logger.debug('Creating broadcast job.', { broadcastUris, unicastUris })

  if (broadcastUris.length !== 0) {
    const payload = {
      uris: broadcastUris,
      signatureActorId: byActor.id,
      body: data,
      contextType
    }

    JobQueue.Instance.createJobAsync({
      type: parallelizable
        ? 'activitypub-http-broadcast-parallel'
        : 'activitypub-http-broadcast',

      payload
    })
  }

  for (const unicastUri of unicastUris) {
    const payload = {
      uri: unicastUri,
      signatureActorId: byActor.id,
      body: data,
      contextType
    }

    JobQueue.Instance.createJobAsync({ type: 'activitypub-http-unicast', payload })
  }
}

function unicastTo (options: {
  data: any
  byActor: MActorId
  toActorUrl: string
  contextType: ContextType
}) {
  const { data, byActor, toActorUrl, contextType } = options

  logger.debug('Creating unicast job.', { uri: toActorUrl })

  const payload = {
    uri: toActorUrl,
    signatureActorId: byActor.id,
    body: data,
    contextType
  }

  JobQueue.Instance.createJobAsync({ type: 'activitypub-http-unicast', payload })
}

// ---------------------------------------------------------------------------

export {
  broadcastToFollowers,
  unicastTo,
  broadcastToActors,
  sendVideoActivityToOrigin,
  forwardVideoRelatedActivity,
  sendVideoRelatedActivity
}

// ---------------------------------------------------------------------------

async function computeFollowerUris (toFollowersOf: MActorId[], actorsException: MActorWithInboxes[], t: Transaction) {
  const toActorFollowerIds = toFollowersOf.map(a => a.id)

  const result = await ActorFollowModel.listAcceptedFollowerSharedInboxUrls(toActorFollowerIds, t)
  const sharedInboxesException = await buildSharedInboxesException(actorsException)

  return result.data.filter(sharedInbox => sharedInboxesException.includes(sharedInbox) === false)
}

async function computeUris (toActors: MActor[], actorsException: MActorWithInboxes[] = []) {
  const serverActor = await getServerActor()
  const targetUrls = toActors
    .filter(a => a.id !== serverActor.id) // Don't send to ourselves
    .map(a => a.getSharedInbox())

  const toActorSharedInboxesSet = new Set(targetUrls)

  const sharedInboxesException = await buildSharedInboxesException(actorsException)
  return Array.from(toActorSharedInboxesSet)
              .filter(sharedInbox => sharedInboxesException.includes(sharedInbox) === false)
}

async function buildSharedInboxesException (actorsException: MActorWithInboxes[]) {
  const serverActor = await getServerActor()

  return actorsException
    .map(f => f.getSharedInbox())
    .concat([ serverActor.sharedInboxUrl ])
}
