import { ActivityPubActor, ActivityPubOrderedCollection } from '@peertube/peertube-models'
import { sanitizeAndCheckActorObject } from '@server/helpers/custom-validators/activitypub/actor.js'
import { isUrlValid } from '@server/helpers/custom-validators/activitypub/misc.js'
import { logger } from '@server/helpers/logger.js'
import { fetchAP } from '../../activity.js'
import { checkUrlsSameHost } from '../../url.js'

export async function fetchRemoteActor (
  actorUrl: string,
  canRefetchPublicKeyOwner = true
): Promise<{ statusCode: number, actorObject: ActivityPubActor }> {
  logger.info('Fetching remote actor %s.', actorUrl)

  const { body, statusCode } = await fetchAP<ActivityPubActor>(actorUrl)

  if (sanitizeAndCheckActorObject(body) === false) {
    logger.debug('Remote actor JSON is not valid.', { actorJSON: body })

    // Retry with the public key owner
    if (canRefetchPublicKeyOwner && hasPublicKeyOwner(actorUrl, body)) {
      logger.debug('Retrying with public key owner ' + body.publicKey.owner)

      return fetchRemoteActor(body.publicKey.owner, false)
    }

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

export async function fetchActorFollowsCount (actorObject: ActivityPubActor) {
  let followersCount = 0
  let followingCount = 0

  if (actorObject.followers) followersCount = await fetchActorTotalItems(actorObject.followers)
  if (actorObject.following) followingCount = await fetchActorTotalItems(actorObject.following)

  return { followersCount, followingCount }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

async function fetchActorTotalItems (url: string) {
  try {
    const { body } = await fetchAP<ActivityPubOrderedCollection<unknown>>(url)

    return body.totalItems || 0
  } catch (err) {
    logger.info('Cannot fetch remote actor count %s.', url, { err })
    return 0
  }
}

function hasPublicKeyOwner (actorUrl: string, actor: ActivityPubActor) {
  return isUrlValid(actor?.publicKey?.owner) && checkUrlsSameHost(actorUrl, actor.publicKey.owner)
}
