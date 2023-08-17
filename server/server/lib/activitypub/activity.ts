import { doJSONRequest, PeerTubeRequestOptions } from '@server/helpers/requests.js'
import { CONFIG } from '@server/initializers/config.js'
import { ActivityObject, ActivityPubActor, ActivityType, APObjectId } from '@peertube/peertube-models'
import { buildSignedRequestOptions } from './send/index.js'

export function getAPId (object: string | { id: string }) {
  if (typeof object === 'string') return object

  return object.id
}

export function getActivityStreamDuration (duration: number) {
  // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-duration
  return 'PT' + duration + 'S'
}

export function getDurationFromActivityStream (duration: string) {
  return parseInt(duration.replace(/[^\d]+/, ''))
}

// ---------------------------------------------------------------------------

export function buildAvailableActivities (): ActivityType[] {
  return [
    'Create',
    'Update',
    'Delete',
    'Follow',
    'Accept',
    'Announce',
    'Undo',
    'Like',
    'Reject',
    'View',
    'Dislike',
    'Flag'
  ]
}

// ---------------------------------------------------------------------------

export async function fetchAP <T> (url: string, moreOptions: PeerTubeRequestOptions = {}) {
  const options = {
    activityPub: true,

    httpSignature: CONFIG.FEDERATION.SIGN_FEDERATED_FETCHES
      ? await buildSignedRequestOptions({ hasPayload: false })
      : undefined,

    ...moreOptions
  }

  return doJSONRequest<T>(url, options)
}

export async function fetchAPObjectIfNeeded <T extends (ActivityObject | ActivityPubActor)> (object: APObjectId) {
  if (typeof object === 'string') {
    const { body } = await fetchAP<Exclude<T, string>>(object)

    return body
  }

  return object as Exclude<T, string>
}

export async function findLatestAPRedirection (url: string, iteration = 1) {
  if (iteration > 10) throw new Error('Too much iterations to find final URL ' + url)

  const { headers } = await fetchAP(url, { followRedirect: false })

  if (headers.location) return findLatestAPRedirection(headers.location, iteration + 1)

  return url
}
