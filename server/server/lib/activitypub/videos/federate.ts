import { Transaction } from 'sequelize'
import { MVideoAP, MVideoAPLight } from '@server/types/models/index.js'
import { sendCreateVideo, sendUpdateVideo } from '../send/index.js'
import { shareVideoByServerAndChannel } from '../share.js'

async function federateVideoIfNeeded (videoArg: MVideoAPLight, isNewVideo: boolean, transaction?: Transaction) {
  const video = videoArg as MVideoAP

  if (
    // Check this is not a blacklisted video, or unfederated blacklisted video
    (video.isBlacklisted() === false || (isNewVideo === false && video.VideoBlacklist.unfederated === false)) &&
    // Check the video is public/unlisted and published
    video.hasPrivacyForFederation() && video.hasStateForFederation()
  ) {
    const video = await videoArg.lightAPToFullAP(transaction)

    if (isNewVideo) {
      // Now we'll add the video's meta data to our followers
      await sendCreateVideo(video, transaction)
      await shareVideoByServerAndChannel(video, transaction)
    } else {
      await sendUpdateVideo(video, transaction)
    }
  }
}

export {
  federateVideoIfNeeded
}
