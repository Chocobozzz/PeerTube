import { ActivityAudience } from '@peertube/peertube-models'
import { ACTIVITY_PUB } from '../../initializers/constants.js'
import { MActorFollowersUrl } from '../../types/models/index.js'

function getAudience (actorSender: MActorFollowersUrl, isPublic = true) {
  return buildAudience([ actorSender.followersUrl ], isPublic)
}

function buildAudience (followerUrls: string[], isPublic = true) {
  let to: string[] = []
  let cc: string[] = []

  if (isPublic) {
    to = [ ACTIVITY_PUB.PUBLIC ]
    cc = followerUrls
  } else { // Unlisted
    to = []
    cc = []
  }

  return { to, cc }
}

function audiencify<T> (object: T, audience: ActivityAudience) {
  return { ...audience, ...object }
}

// ---------------------------------------------------------------------------

export {
  buildAudience,
  getAudience,
  audiencify
}
