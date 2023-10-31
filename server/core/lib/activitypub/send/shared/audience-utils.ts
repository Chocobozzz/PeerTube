import { Transaction } from 'sequelize'
import { ACTIVITY_PUB } from '@server/initializers/constants.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { VideoModel } from '@server/models/video/video.js'
import { VideoShareModel } from '@server/models/video/video-share.js'
import { MActorFollowersUrl, MActorUrl, MCommentOwner, MCommentOwnerVideo, MVideoId } from '@server/types/models/index.js'
import { ActivityAudience } from '@peertube/peertube-models'

function getOriginVideoAudience (accountActor: MActorUrl, actorsInvolvedInVideo: MActorFollowersUrl[] = []): ActivityAudience {
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
  const actors = await VideoShareModel.listActorIdsAndFollowerUrlsByShare(video.id, t)

  const alreadyLoadedActor = (video as VideoModel).VideoChannel?.Account?.Actor

  const videoActor = alreadyLoadedActor?.url && alreadyLoadedActor?.followersUrl
    ? alreadyLoadedActor
    : await ActorModel.loadAccountActorFollowerUrlByVideoId(video.id, t)

  actors.push(videoActor)

  return actors
}

// ---------------------------------------------------------------------------

export {
  getOriginVideoAudience,
  getActorsInvolvedInVideo,
  getAudienceFromFollowersOf,
  getVideoCommentAudience
}
