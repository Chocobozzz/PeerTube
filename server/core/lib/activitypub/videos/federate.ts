import { forceNumber } from '@peertube/peertube-core-utils'
import { VideoPrivacy, VideoPrivacyType, VideoState, VideoStateType } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { MVideoAPLight, MVideoWithBlacklistRights } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { sendCreateVideo, sendUpdateVideo } from '../send/index.js'
import { shareByServer, shareByVideoChannel } from '../share.js'

export async function federateVideoIfNeeded (videoArg: MVideoAPLight, isNewVideo: boolean, transaction?: Transaction) {
  if (!canVideoBeFederated(videoArg, isNewVideo)) return

  const video = await videoArg.lightAPToFullAP(transaction)

  if (isNewVideo) {
    // Now we'll add the video's meta data to our followers
    await sendCreateVideo(video, transaction)

    await Promise.all([
      shareByServer(video, transaction),
      shareByVideoChannel(video, transaction)
    ])
  } else {
    await sendUpdateVideo(video, transaction)
  }
}

export function canVideoBeFederated (video: MVideoWithBlacklistRights, isNewVideo = false) {
  // Check this is not a blacklisted video
  if (video.isBlacklisted() === true) {
    if (isNewVideo === false) return false
    if (video.VideoBlacklist.unfederated === true) return false
  }

  // Check the video is public/unlisted and published
  return isPrivacyForFederation(video.privacy) && isStateForFederation(video.state)
}

export function isNewVideoPrivacyForFederation (currentPrivacy: VideoPrivacyType, newPrivacy: VideoPrivacyType) {
  return !isPrivacyForFederation(currentPrivacy) && isPrivacyForFederation(newPrivacy)
}

export function isPrivacyForFederation (privacy: VideoPrivacyType) {
  const castedPrivacy = forceNumber(privacy)

  return castedPrivacy === VideoPrivacy.PUBLIC ||
    (CONFIG.FEDERATION.VIDEOS.FEDERATE_UNLISTED === true && castedPrivacy === VideoPrivacy.UNLISTED)
}

export function isStateForFederation (state: VideoStateType) {
  const castedState = forceNumber(state)

  return castedState === VideoState.PUBLISHED || castedState === VideoState.WAITING_FOR_LIVE || castedState === VideoState.LIVE_ENDED
}
