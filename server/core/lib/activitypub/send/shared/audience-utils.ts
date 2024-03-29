import { ActivityAudience } from '@peertube/peertube-models'
import { getAPPublicValue } from '@server/helpers/activity-pub-utils.js'
import { ActorModel } from '@server/models/actor/actor.js'
import { VideoShareModel } from '@server/models/video/video-share.js'
import { VideoModel } from '@server/models/video/video.js'
import { MActorFollowersUrl, MActorUrl, MCommentOwner, MCommentOwnerVideo, MVideoId } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'

export function getOriginVideoAudience (accountActor: MActorUrl, actorsInvolvedInVideo: MActorFollowersUrl[] = []): ActivityAudience {
  return {
    to: [ accountActor.url ],
    cc: actorsInvolvedInVideo.map(a => a.followersUrl)
  }
}

export function getVideoCommentAudience (
  videoComment: MCommentOwnerVideo,
  threadParentComments: MCommentOwner[],
  actorsInvolvedInVideo: MActorFollowersUrl[],
  isOrigin = false
): ActivityAudience {
  const to = [ getAPPublicValue() ]
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

export function getAudienceFromFollowersOf (actorsInvolvedInObject: MActorFollowersUrl[]): ActivityAudience {
  return {
    to: [ getAPPublicValue() as string ].concat(actorsInvolvedInObject.map(a => a.followersUrl)),
    cc: []
  }
}

export async function getActorsInvolvedInVideo (video: MVideoId, t: Transaction) {
  const actors = await VideoShareModel.listActorIdsAndFollowerUrlsByShare(video.id, t)

  const alreadyLoadedActor = (video as VideoModel).VideoChannel?.Account?.Actor

  const videoActor = alreadyLoadedActor?.url && alreadyLoadedActor?.followersUrl
    ? alreadyLoadedActor
    : await ActorModel.loadAccountActorFollowerUrlByVideoId(video.id, t)

  actors.push(videoActor)

  return actors
}
