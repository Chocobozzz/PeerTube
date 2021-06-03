
import { checkUrlsSameHost } from '@server/helpers/activitypub'
import { sanitizeAndCheckActorObject } from '@server/helpers/custom-validators/activitypub/actor'
import { logger } from '@server/helpers/logger'
import { doJSONRequest } from '@server/helpers/requests'
import { ActivityPubActor, ActivityPubOrderedCollection } from '@shared/models'

async function fetchRemoteActor (actorUrl: string): Promise<{ statusCode: number, actorObject: ActivityPubActor }> {
  logger.info('Fetching remote actor %s.', actorUrl)

  const { body, statusCode } = await doJSONRequest<ActivityPubActor>(actorUrl, { activityPub: true })

  if (sanitizeAndCheckActorObject(body) === false) {
    logger.debug('Remote actor JSON is not valid.', { actorJSON: body })
    return { actorObject: undefined, statusCode: statusCode }
  }

  if (checkUrlsSameHost(body.id, actorUrl) !== true) {
    logger.warn('Actor url %s has not the same host than its AP id %s', actorUrl, body.id)
    return { actorObject: undefined, statusCode: statusCode }
  }

  return {
    statusCode,

    actorObject: body
  }
}

async function fetchActorFollowsCount (actorObject: ActivityPubActor) {
  const followersCount = await fetchActorTotalItems(actorObject.followers)
  const followingCount = await fetchActorTotalItems(actorObject.following)

  return { followersCount, followingCount }
}

// ---------------------------------------------------------------------------
export {
  fetchActorFollowsCount,
  fetchRemoteActor
}

// ---------------------------------------------------------------------------

async function fetchActorTotalItems (url: string) {
  try {
    const { body } = await doJSONRequest<ActivityPubOrderedCollection<unknown>>(url, { activityPub: true })

    return body.totalItems || 0
  } catch (err) {
    logger.warn('Cannot fetch remote actor count %s.', url, { err })
    return 0
  }
}
