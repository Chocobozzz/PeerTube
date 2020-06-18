import { Transaction } from 'sequelize'
import { ActivityAudience, ActivityUpdate } from '../../../../shared/models/activitypub'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { AccountModel } from '../../../models/account/account'
import { VideoModel } from '../../../models/video/video'
import { VideoShareModel } from '../../../models/video/video-share'
import { getUpdateActivityPubUrl } from '../url'
import { broadcastToFollowers, sendVideoRelatedActivity } from './utils'
import { audiencify, getActorsInvolvedInVideo, getAudience } from '../audience'
import { logger } from '../../../helpers/logger'
import { VideoPlaylistPrivacy } from '../../../../shared/models/videos/playlist/video-playlist-privacy.model'
import {
  MAccountDefault,
  MActor,
  MActorLight,
  MChannelDefault,
  MVideoAP,
  MVideoAPWithoutCaption,
  MVideoPlaylistFull,
  MVideoRedundancyVideo
} from '../../../types/models'
import { getServerActor } from '@server/models/application/application'

async function sendUpdateVideo (videoArg: MVideoAPWithoutCaption, t: Transaction, overrodeByActor?: MActor) {
  const video = videoArg as MVideoAP

  if (!video.hasPrivacyForFederation()) return undefined

  logger.info('Creating job to update video %s.', video.url)

  const byActor = overrodeByActor || video.VideoChannel.Account.Actor

  const url = getUpdateActivityPubUrl(video.url, video.updatedAt.toISOString())

  // Needed to build the AP object
  if (!video.VideoCaptions) {
    video.VideoCaptions = await video.$get('VideoCaptions', { transaction: t })
  }

  const videoObject = video.toActivityPubObject()
  const audience = getAudience(byActor, video.privacy === VideoPrivacy.PUBLIC)

  const updateActivity = buildUpdateActivity(url, byActor, videoObject, audience)

  const actorsInvolved = await getActorsInvolvedInVideo(video, t)
  if (overrodeByActor) actorsInvolved.push(overrodeByActor)

  return broadcastToFollowers(updateActivity, byActor, actorsInvolved, t)
}

async function sendUpdateActor (accountOrChannel: MChannelDefault | MAccountDefault, t: Transaction) {
  const byActor = accountOrChannel.Actor

  logger.info('Creating job to update actor %s.', byActor.url)

  const url = getUpdateActivityPubUrl(byActor.url, byActor.updatedAt.toISOString())
  const accountOrChannelObject = (accountOrChannel as any).toActivityPubObject() // FIXME: typescript bug?
  const audience = getAudience(byActor)
  const updateActivity = buildUpdateActivity(url, byActor, accountOrChannelObject, audience)

  let actorsInvolved: MActor[]
  if (accountOrChannel instanceof AccountModel) {
    // Actors that shared my videos are involved too
    actorsInvolved = await VideoShareModel.loadActorsWhoSharedVideosOf(byActor.id, t)
  } else {
    // Actors that shared videos of my channel are involved too
    actorsInvolved = await VideoShareModel.loadActorsByVideoChannel(accountOrChannel.id, t)
  }

  actorsInvolved.push(byActor)

  return broadcastToFollowers(updateActivity, byActor, actorsInvolved, t)
}

async function sendUpdateCacheFile (byActor: MActorLight, redundancyModel: MVideoRedundancyVideo) {
  logger.info('Creating job to update cache file %s.', redundancyModel.url)

  const video = await VideoModel.loadAndPopulateAccountAndServerAndTags(redundancyModel.getVideo().id)

  const activityBuilder = (audience: ActivityAudience) => {
    const redundancyObject = redundancyModel.toActivityPubObject()
    const url = getUpdateActivityPubUrl(redundancyModel.url, redundancyModel.updatedAt.toISOString())

    return buildUpdateActivity(url, byActor, redundancyObject, audience)
  }

  return sendVideoRelatedActivity(activityBuilder, { byActor, video, contextType: 'CacheFile' })
}

async function sendUpdateVideoPlaylist (videoPlaylist: MVideoPlaylistFull, t: Transaction) {
  if (videoPlaylist.privacy === VideoPlaylistPrivacy.PRIVATE) return undefined

  const byActor = videoPlaylist.OwnerAccount.Actor

  logger.info('Creating job to update video playlist %s.', videoPlaylist.url)

  const url = getUpdateActivityPubUrl(videoPlaylist.url, videoPlaylist.updatedAt.toISOString())

  const object = await videoPlaylist.toActivityPubObject(null, t)
  const audience = getAudience(byActor, videoPlaylist.privacy === VideoPlaylistPrivacy.PUBLIC)

  const updateActivity = buildUpdateActivity(url, byActor, object, audience)

  const serverActor = await getServerActor()
  const toFollowersOf = [ byActor, serverActor ]

  if (videoPlaylist.VideoChannel) toFollowersOf.push(videoPlaylist.VideoChannel.Actor)

  return broadcastToFollowers(updateActivity, byActor, toFollowersOf, t)
}

// ---------------------------------------------------------------------------

export {
  sendUpdateActor,
  sendUpdateVideo,
  sendUpdateCacheFile,
  sendUpdateVideoPlaylist
}

// ---------------------------------------------------------------------------

function buildUpdateActivity (url: string, byActor: MActorLight, object: any, audience?: ActivityAudience): ActivityUpdate {
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
