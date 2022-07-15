import { sanitizeAndCheckActorObject } from '@server/helpers/custom-validators/activitypub/actor'
import { logger } from '@server/helpers/logger'
import { doJSONRequest } from '@server/helpers/requests'
import { ActivityPubActor, ActivityPubOrderedCollection } from '@shared/models'
import { checkUrlsSameHost } from '../../url'

async function fetchRemoteActor (actorUrl: string): Promise<{ statusCode: number, actorObject: ActivityPubActor }> {
  logger.info('Fetching remote actor %s.', actorUrl)

  const { body, statusCode } = await doJSONRequest<ActivityPubActor>(actorUrl, { activityPub: true })

  if (sanitizeAndCheckActorObject(body) === false) {
    logger.debug('Remote actor JSON is not valid.', { actorJSON: body })
    return { actorObject: undefined, statusCode }
  }

  if (checkUrlsSameHost(body.id, actorUrl) !== true) {
    logger.warn('Actor url %s has not the same host than its AP id %s', actorUrl, body.id)
    return { actorObject: undefined, statusCode }
  }

  return {
    statusCode,

    actorObject: body
  }
}

async function fetchActorFollowsCount (actorObject: ActivityPubActor) {
  let followersCount = 0
  let followingCount = 0

  if (actorObject.followers) followersCount = await fetchActorTotalItems(actorObject.followers)
  if (actorObject.following) followingCount = await fetchActorTotalItems(actorObject.following)

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
    logger.info('Cannot fetch remote actor count %s.', url, { err })
    return 0
  }
}
