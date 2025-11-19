import { ActivityAudience, ActivityUpdate, ActivityUpdateObject, VideoPlaylistPrivacy } from '@peertube/peertube-models'
import { getServerActor } from '@server/models/application/application.js'
import { PlayerSettingModel } from '@server/models/video/player-setting.js'
import { MPlayerSetting } from '@server/types/models/video/player-setting.js'
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
  MVideoFullLight,
  MVideoPlaylistFull,
  MVideoRedundancyVideo
} from '../../../types/models/index.js'
import { audiencify, getPlaylistAudience, getPublicAudience, getVideoAudience } from '../audience.js'
import { getLocalChannelPlayerSettingsActivityPubUrl, getLocalVideoPlayerSettingsActivityPubUrl, getUpdateActivityPubUrl } from '../url.js'
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
  const audience = getVideoAudience(byActor, video.privacy)

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
  const audience = getPublicAudience(byActor)
  const updateActivity = buildUpdateActivity(url, byActor, accountOrChannelObject, audience)

  return broadcastToFollowers({
    data: updateActivity,
    byActor,
    toFollowersOf: await getToFollowersOfForActor(accountOrChannel, transaction),
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
  const audience = getPlaylistAudience(byActor, videoPlaylist.privacy)

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

export async function sendUpdateVideoPlayerSettings (video: MVideoFullLight, settings: MPlayerSetting, transaction: Transaction) {
  if (!canVideoBeFederated(video, false)) return

  const byActor = video.VideoChannel.Account.Actor
  const settingsUrl = getLocalVideoPlayerSettingsActivityPubUrl(video)

  logger.info('Creating job to update video player settings ' + settingsUrl)

  const updateUrl = getUpdateActivityPubUrl(settingsUrl, settings.updatedAt.toISOString())

  const object = PlayerSettingModel.formatAPPlayerSetting({ settings, video, channel: undefined })
  const audience = getVideoAudience(byActor, video.privacy)

  const updateActivity = buildUpdateActivity(updateUrl, byActor, object, audience)

  const toFollowersOf = await getActorsInvolvedInVideo(video, transaction)

  return broadcastToFollowers({
    data: updateActivity,
    byActor,
    toFollowersOf,
    transaction,
    contextType: 'PlayerSettings'
  })
}

export async function sendUpdateChannelPlayerSettings (channel: MChannelDefault, settings: MPlayerSetting, transaction: Transaction) {
  const byActor = channel.Actor
  const settingsUrl = getLocalChannelPlayerSettingsActivityPubUrl(channel.Actor.preferredUsername)

  logger.info('Creating job to update channel player settings actor ' + settingsUrl)

  const url = getUpdateActivityPubUrl(byActor.url, byActor.updatedAt.toISOString())
  const object = PlayerSettingModel.formatAPPlayerSetting({ settings, video: undefined, channel })

  const audience = getPublicAudience(byActor)
  const updateActivity = buildUpdateActivity(url, byActor, object, audience)

  return broadcastToFollowers({
    data: updateActivity,
    byActor,
    toFollowersOf: await getToFollowersOfForActor(channel, transaction),
    transaction,
    contextType: 'PlayerSettings'
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
  if (!audience) audience = getPublicAudience(byActor)

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

async function getToFollowersOfForActor (accountOrChannel: MChannelDefault | MAccountDefault, transaction?: Transaction) {
  let actorsInvolved: MActor[]
  if (accountOrChannel instanceof AccountModel) {
    // Actors that shared my videos are involved too
    actorsInvolved = await VideoShareModel.listActorsWhoSharedVideosOf({ actorOwnerId: accountOrChannel.Actor.id, transaction })
  } else {
    // Actors that shared videos of my channel are involved too
    actorsInvolved = await VideoShareModel.listActorsByVideoChannel({ channelId: accountOrChannel.id, transaction })
  }

  actorsInvolved.push(accountOrChannel.Actor)

  return actorsInvolved
}
