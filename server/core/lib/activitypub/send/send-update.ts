import { ActivityAudience, ActivityUpdate, ActivityUpdateObject, VideoPlaylistPrivacy, VideoPrivacy } from '@peertube/peertube-models'
import { getServerActor } from '@server/models/application/application.js'
import { Transaction } from 'sequelize'
import { logger } from '../../../helpers/logger.js'
import { AccountModel } from '../../../models/account/account.js'
import { VideoShareModel } from '../../../models/video/video-share.js'
import { VideoModel } from '../../../models/video/video.js'
import {
  MAccountDefault,
  MActor,
  MActorLight,
  MChannelDefault,
  MVideoAPLight,
  MVideoPlaylistFull,
  MVideoRedundancyVideo
} from '../../../types/models/index.js'
import { audiencify, getAudience } from '../audience.js'
import { getUpdateActivityPubUrl } from '../url.js'
import { canVideoBeFederated } from '../videos/federate.js'
import { getActorsInvolvedInVideo } from './shared/index.js'
import { broadcastToFollowers, sendVideoRelatedActivity } from './shared/send-utils.js'

export async function sendUpdateVideo (videoArg: MVideoAPLight, transaction: Transaction, overriddenByActor?: MActor) {
  if (!canVideoBeFederated(videoArg)) return undefined

  const video = await videoArg.lightAPToFullAP(transaction)

  logger.info('Creating job to update video %s.', video.url)

  const byActor = overriddenByActor || video.VideoChannel.Account.Actor

  const url = getUpdateActivityPubUrl(video.url, video.updatedAt.toISOString())

  const videoObject = await video.toActivityPubObject()
  const audience = getAudience(byActor, video.privacy === VideoPrivacy.PUBLIC)

  const updateActivity = buildUpdateActivity(url, byActor, videoObject, audience)

  const actorsInvolved = await getActorsInvolvedInVideo(video, transaction)
  if (overriddenByActor) actorsInvolved.push(overriddenByActor)

  return broadcastToFollowers({
    data: updateActivity,
    byActor,
    toFollowersOf: actorsInvolved,
    contextType: 'Video',
    transaction
  })
}

export async function sendUpdateActor (accountOrChannel: MChannelDefault | MAccountDefault, transaction: Transaction) {
  const byActor = accountOrChannel.Actor

  logger.info('Creating job to update actor %s.', byActor.url)

  const url = getUpdateActivityPubUrl(byActor.url, byActor.updatedAt.toISOString())
  const accountOrChannelObject = await (accountOrChannel as any).toActivityPubObject() // FIXME: typescript bug?
  const audience = getAudience(byActor)
  const updateActivity = buildUpdateActivity(url, byActor, accountOrChannelObject, audience)

  let actorsInvolved: MActor[]
  if (accountOrChannel instanceof AccountModel) {
    // Actors that shared my videos are involved too
    actorsInvolved = await VideoShareModel.loadActorsWhoSharedVideosOf(byActor.id, transaction)
  } else {
    // Actors that shared videos of my channel are involved too
    actorsInvolved = await VideoShareModel.loadActorsByVideoChannel(accountOrChannel.id, transaction)
  }

  actorsInvolved.push(byActor)

  return broadcastToFollowers({
    data: updateActivity,
    byActor,
    toFollowersOf: actorsInvolved,
    transaction,
    contextType: 'Actor'
  })
}

export async function sendUpdateCacheFile (byActor: MActorLight, redundancyModel: MVideoRedundancyVideo) {
  logger.info('Creating job to update cache file %s.', redundancyModel.url)

  const associatedVideo = redundancyModel.getVideo()
  if (!associatedVideo) {
    logger.warn('Cannot send update activity for redundancy %s: no video files associated.', redundancyModel.url)
    return
  }

  const video = await VideoModel.loadFull(associatedVideo.id)

  const activityBuilder = (audience: ActivityAudience) => {
    const redundancyObject = redundancyModel.toActivityPubObject()
    const url = getUpdateActivityPubUrl(redundancyModel.url, redundancyModel.updatedAt.toISOString())

    return buildUpdateActivity(url, byActor, redundancyObject, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, { byActor, video, contextType: 'CacheFile' })
}

export async function sendUpdateVideoPlaylist (videoPlaylist: MVideoPlaylistFull, transaction: Transaction) {
  if (videoPlaylist.privacy === VideoPlaylistPrivacy.PRIVATE) return undefined

  const byActor = videoPlaylist.OwnerAccount.Actor

  logger.info('Creating job to update video playlist %s.', videoPlaylist.url)

  const url = getUpdateActivityPubUrl(videoPlaylist.url, videoPlaylist.updatedAt.toISOString())

  const object = await videoPlaylist.toActivityPubObject(null, transaction)
  const audience = getAudience(byActor, videoPlaylist.privacy === VideoPlaylistPrivacy.PUBLIC)

  const updateActivity = buildUpdateActivity(url, byActor, object, audience)

  const serverActor = await getServerActor()
  const toFollowersOf = [ byActor, serverActor ]

  if (videoPlaylist.VideoChannel) toFollowersOf.push(videoPlaylist.VideoChannel.Actor)

  return broadcastToFollowers({
    data: updateActivity,
    byActor,
    toFollowersOf,
    transaction,
    contextType: 'Playlist'
  })
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildUpdateActivity (
  url: string,
  byActor: MActorLight,
  object: ActivityUpdateObject,
  audience?: ActivityAudience
): ActivityUpdate<ActivityUpdateObject> {
  if (!audience) audience = getAudience(byActor)

  return audiencify(
    {
      type: 'Update' as 'Update',
      id: url,
      actor: byActor.url,
      object: audiencify(object, audience)
    },
    audience
  )
}
