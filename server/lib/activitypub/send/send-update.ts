import { Transaction } from 'sequelize'
import { getServerActor } from '@server/models/application/application'
import { ActivityAudience, ActivityUpdate, ActivityUpdateObject, VideoPlaylistPrivacy, VideoPrivacy } from '@shared/models'
import { logger } from '../../../helpers/logger'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import {
  MAccountDefault,
  MActor,
  MActorLight,
  MChannelDefault,
  MVideoAPLight,
  MVideoPlaylistFull,
  MVideoRedundancyVideo
} from '../../../types/models'
import { audiencify, getAudience } from '../audience'
import { getUpdateActivityPubUrl } from '../url'
import { getActorsInvolvedInVideo } from './shared'
import { broadcastToFollowers, sendVideoRelatedActivity } from './shared/send-utils'

async function sendUpdateVideo (videoArg: MVideoAPLight, transaction: Transaction, overriddenByActor?: MActor) {
  if (!videoArg.hasPrivacyForFederation()) return undefined

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

async function sendUpdateActor (accountOrChannel: MChannelDefault | MAccountDefault, transaction: Transaction) {
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

async function sendUpdateCacheFile (byActor: MActorLight, redundancyModel: MVideoRedundancyVideo) {
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

async function sendUpdateVideoPlaylist (videoPlaylist: MVideoPlaylistFull, transaction: Transaction) {
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

export {
  sendUpdateActor,
  sendUpdateVideo,
  sendUpdateCacheFile,
  sendUpdateVideoPlaylist
}

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
