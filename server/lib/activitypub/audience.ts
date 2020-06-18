import { Transaction } from 'sequelize'
import { ActivityAudience } from '../../../shared/models/activitypub'
import { ACTIVITY_PUB } from '../../initializers/constants'
import { ActorModel } from '../../models/activitypub/actor'
import { VideoModel } from '../../models/video/video'
import { VideoShareModel } from '../../models/video/video-share'
import { MActorFollowersUrl, MActorLight, MActorUrl, MCommentOwner, MCommentOwnerVideo, MVideoId } from '../../types/models'

function getRemoteVideoAudience (accountActor: MActorUrl, actorsInvolvedInVideo: MActorFollowersUrl[]): ActivityAudience {
  return {
    to: [ accountActor.url ],
    cc: actorsInvolvedInVideo.map(a => a.followersUrl)
  }
}

function getVideoCommentAudience (
  videoComment: MCommentOwnerVideo,
  threadParentComments: MCommentOwner[],
  actorsInvolvedInVideo: MActorFollowersUrl[],
  isOrigin = false
): ActivityAudience {
  const to = [ ACTIVITY_PUB.PUBLIC ]
  const cc: string[] = []

  // Owner of the video we comment
  if (isOrigin === false) {
    cc.push(videoComment.Video.VideoChannel.Account.Actor.url)
  }

  // Followers of the poster
  cc.push(videoComment.Account.Actor.followersUrl)

  // Send to actors we reply to
  for (const parentComment of threadParentComments) {
    if (parentComment.isDeleted()) continue

    cc.push(parentComment.Account.Actor.url)
  }

  return {
    to,
    cc: cc.concat(actorsInvolvedInVideo.map(a => a.followersUrl))
  }
}

function getAudienceFromFollowersOf (actorsInvolvedInObject: MActorFollowersUrl[]): ActivityAudience {
  return {
    to: [ ACTIVITY_PUB.PUBLIC ].concat(actorsInvolvedInObject.map(a => a.followersUrl)),
    cc: []
  }
}

async function getActorsInvolvedInVideo (video: MVideoId, t: Transaction) {
  const actors: MActorLight[] = await VideoShareModel.loadActorsByShare(video.id, t)

  const videoAll = video as VideoModel

  const videoActor = videoAll.VideoChannel?.Account
    ? videoAll.VideoChannel.Account.Actor
    : await ActorModel.loadFromAccountByVideoId(video.id, t)

  actors.push(videoActor)

  return actors
}

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
  return Object.assign(object, audience)
}

// ---------------------------------------------------------------------------

export {
  buildAudience,
  getAudience,
  getRemoteVideoAudience,
  getActorsInvolvedInVideo,
  getAudienceFromFollowersOf,
  audiencify,
  getVideoCommentAudience
}
