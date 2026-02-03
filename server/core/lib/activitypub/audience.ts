import { ActivityAudience, VideoPlaylistPrivacy, VideoPlaylistPrivacyType, VideoPrivacy, VideoPrivacyType } from '@peertube/peertube-models'
import { getAPPublicValue } from '@server/helpers/activity-pub-utils.js'
import {
  MAccountAudience,
  MActorFollowersUrl,
  MActorUrl,
  MChannelAudience,
  MCommentOwner,
  MVideoAccountLight
} from '../../types/models/index.js'

export function getPublicAudience (actorSender: MActorFollowersUrl) {
  return _buildPublicAudience({ cc: [ actorSender.followersUrl ] })
}

export function getDirectAudience (targetActor: MActorUrl): ActivityAudience {
  return { to: [ targetActor.url ], cc: [] }
}

export function getVideoAudience (options: {
  account: MAccountAudience
  channel: MChannelAudience
  privacy: VideoPrivacyType
  skipPrivacyCheck?: boolean // default false
}) {
  const { account, channel, privacy, skipPrivacyCheck = false } = options

  const followerUrls = [ account.Actor.followersUrl ]

  if (privacy === VideoPrivacy.PUBLIC) {
    return _buildPublicAudience({
      to: [ channel.Actor.url ], // fep-1b12
      cc: followerUrls
    })
  }

  if (privacy === VideoPrivacy.UNLISTED) {
    return _buildUnlistedAudience()
  }

  if (skipPrivacyCheck) {
    return _buildPrivateAudience()
  }

  throw new Error(`Cannot get audience of non public/unlisted video privacy type (${privacy})`)
}

export function getCommentAudience (options: {
  comment: MCommentOwner
  video: MVideoAccountLight
  threadParentComments: MCommentOwner[]
}): ActivityAudience {
  const { comment, video, threadParentComments } = options

  const audience: ActivityAudience = {
    to: [ getAPPublicValue() ],

    cc: [
      comment.Account.Actor.followersUrl, // Followers of the commenter
      video.VideoChannel.Account.Actor.url, // Owner of the video
      video.VideoChannel.Actor.url // fep-1b12
    ]
  }

  // Send to actors we reply to
  for (const parentComment of threadParentComments) {
    if (parentComment.isDeleted()) continue

    audience.cc.push(parentComment.Account.Actor.url)
  }

  return audience
}

export function getPlaylistAudience (actorSender: MActorFollowersUrl, privacy: VideoPlaylistPrivacyType) {
  const followerUrls = [ actorSender.followersUrl ]

  if (privacy === VideoPlaylistPrivacy.PUBLIC) return _buildPublicAudience({ cc: followerUrls })
  else if (privacy === VideoPlaylistPrivacy.UNLISTED) return _buildUnlistedAudience()

  throw new Error(`Cannot get audience of non public/unlisted playlist privacy type (${privacy})`)
}

export function audiencify<T> (object: T, audience: ActivityAudience) {
  return { ...audience, ...object }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function _buildPublicAudience (options: {
  to?: string[]
  cc?: string[]
}) {
  const { to = [], cc = [] } = options

  return { to: [ getAPPublicValue(), ...to ], cc }
}

function _buildUnlistedAudience () {
  return { to: [], cc: [ getAPPublicValue() ] }
}

function _buildPrivateAudience () {
  return { to: [], cc: [] }
}
