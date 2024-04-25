import { ActivityAudience } from '@peertube/peertube-models'
import { getAPPublicValue } from '@server/helpers/activity-pub-utils.js'
import { MActorFollowersUrl } from '../../types/models/index.js'

export function getAudience (actorSender: MActorFollowersUrl, isPublic = true) {
  return buildAudience([ actorSender.followersUrl ], isPublic)
}

export function buildAudience (followerUrls: string[], isPublic = true) {
  let to: string[] = []
  let cc: string[] = []

  if (isPublic) {
    to = [ getAPPublicValue() ]
    cc = followerUrls
  } else { // Unlisted
    to = []
    cc = []
  }

  return { to, cc }
}

export function audiencify<T> (object: T, audience: ActivityAudience) {
  return { ...audience, ...object }
}
