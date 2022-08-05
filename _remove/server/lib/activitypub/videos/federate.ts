import { Transaction } from 'sequelize/types'
import { isArray } from '@server/helpers/custom-validators/misc'
import { MVideoAP, MVideoAPWithoutCaption } from '@server/types/models'
import { sendCreateVideo, sendUpdateVideo } from '../send'
import { shareVideoByServerAndChannel } from '../share'

async function federateVideoIfNeeded (videoArg: MVideoAPWithoutCaption, isNewVideo: boolean, transaction?: Transaction) {
  const video = videoArg as MVideoAP

  if (
    // Check this is not a blacklisted video, or unfederated blacklisted video
    (video.isBlacklisted() === false || (isNewVideo === false && video.VideoBlacklist.unfederated === false)) &&
    // Check the video is public/unlisted and published
    video.hasPrivacyForFederation() && video.hasStateForFederation()
  ) {
    // Fetch more attributes that we will need to serialize in AP object
    if (isArray(video.VideoCaptions) === false) {
      video.VideoCaptions = await video.$get('VideoCaptions', {
        attributes: [ 'filename', 'language' ],
        transaction
      })
    }

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
