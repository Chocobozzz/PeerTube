import { ActivityAudience, VideoPlaylistPrivacy, VideoPlaylistPrivacyType, VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'
import { getAPPublicValue } from '@server/helpers/activity-pub-utils.js'
import { MActorFollowersUrl } from '../../types/models/index.js'

export function getPublicAudience (actorSender: MActorFollowersUrl) {
  return buildAudience([ actorSender.followersUrl ], 'public')
}

export function getVideoAudience (actorSender: MActorFollowersUrl, privacy: VideoPrivacyType, options: {
  skipPrivacyCheck?: boolean // default false
} = {}) {
  const { skipPrivacyCheck = false } = options

  const followerUrls = [ actorSender.followersUrl ]

  if (privacy === VideoPrivacy.PUBLIC) return buildAudience(followerUrls, 'public')
  else if (privacy === VideoPrivacy.UNLISTED) return buildAudience(followerUrls, 'unlisted')

  if (skipPrivacyCheck) return buildAudience(followerUrls, 'private')

  throw new Error(`Cannot get audience of non public/unlisted video privacy type (${privacy})`)
}

export function getPlaylistAudience (actorSender: MActorFollowersUrl, privacy: VideoPlaylistPrivacyType) {
  const followerUrls = [ actorSender.followersUrl ]

  if (privacy === VideoPlaylistPrivacy.PUBLIC) return buildAudience(followerUrls, 'public')
  else if (privacy === VideoPlaylistPrivacy.UNLISTED) return buildAudience(followerUrls, 'unlisted')

  throw new Error(`Cannot get audience of non public/unlisted playlist privacy type (${privacy})`)
}

export function audiencify<T> (object: T, audience: ActivityAudience) {
  return { ...audience, ...object }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildAudience (followerUrls: string[], type: 'public' | 'unlisted' | 'private') {
  let to: string[] = []
  let cc: string[] = []

  if (type === 'public') {
    to = [ getAPPublicValue() ]
    cc = followerUrls
  } else if (type === 'unlisted') {
    to = []
    cc = [ getAPPublicValue() ]
  } else {
    to = []
    cc = []
  }

  return { to, cc }
}
