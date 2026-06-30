import { forceNumber } from '@peertube/peertube-core-utils'
import { VideoPrivacy, VideoPrivacyType, VideoState, VideoStateType } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { MVideoAPLight, MVideoWithBlacklistRights } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { sendCreateVideo, sendUpdateVideo } from '../send/index.js'
import { isSharedByServer, shareByServerIfNeeded, shareByVideoChannelIfNeeded } from '../share.js'

export async function federateVideoIfNeeded (videoArg: MVideoAPLight, transaction?: Transaction) {
  if (!canVideoBeFederated(videoArg)) return

  const alreadyShared = await isSharedByServer({ video: videoArg, transaction })

  const video = await videoArg.lightAPToFullAP(transaction)

  if (!alreadyShared) {
    await sendCreateVideo(video, transaction)

    await Promise.all([
      shareByServerIfNeeded({ video, skipFederation: false, transaction }),
      shareByVideoChannelIfNeeded({ video, skipFederation: false, transaction })
    ])
  } else {
    // Keep send update after these functions, so it takes into account new shares created
    await Promise.all([
      shareByServerIfNeeded({ video, skipFederation: true, transaction }),
      shareByVideoChannelIfNeeded({ video, skipFederation: true, transaction })
    ])

    await sendUpdateVideo(video, transaction)
  }
}

export function canVideoBeFederated (video: MVideoWithBlacklistRights) {
  // Check this is not a blacklisted video
  if (video.isBlacklisted() === true && video.VideoBlacklist.unfederated === true) return false

  // Check the video is public/unlisted and published
  return isPrivacyForFederation(video.privacy) && isStateForFederation(video.state)
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
