import { Response } from 'express'
import { fetchVideo, VideoFetchType } from '../video'
import { UserModel } from '../../models/account/user'
import { UserRight } from '../../../shared/models/users'
import { VideoChannelModel } from '../../models/video/video-channel'
import { VideoModel } from '../../models/video/video'

async function doesVideoExist (id: number | string, res: Response, fetchType: VideoFetchType = 'all') {
  const userId = res.locals.oauth ? res.locals.oauth.token.User.id : undefined

  const video = await fetchVideo(id, fetchType, userId)

  if (video === null) {
    res.status(404)
       .json({ error: 'Video not found' })
       .end()

    return false
  }

  if (fetchType !== 'none') res.locals.video = video
  return true
}

async function doesVideoChannelOfAccountExist (channelId: number, user: UserModel, res: Response) {
  if (user.hasRight(UserRight.UPDATE_ANY_VIDEO) === true) {
    const videoChannel = await VideoChannelModel.loadAndPopulateAccount(channelId)
    if (videoChannel === null) {
      res.status(400)
         .json({ error: 'Unknown video `video channel` on this instance.' })
         .end()

      return false
    }

    res.locals.videoChannel = videoChannel
    return true
  }

  const videoChannel = await VideoChannelModel.loadByIdAndAccount(channelId, user.Account.id)
  if (videoChannel === null) {
    res.status(400)
       .json({ error: 'Unknown video `video channel` for this account.' })
       .end()

    return false
  }

  res.locals.videoChannel = videoChannel
  return true
}

function checkUserCanManageVideo (user: UserModel, video: VideoModel, right: UserRight, res: Response) {
  // Retrieve the user who did the request
  if (video.isOwned() === false) {
    res.status(403)
       .json({ error: 'Cannot manage a video of another server.' })
       .end()
    return false
  }

  // Check if the user can delete the video
  // The user can delete it if he has the right
  // Or if s/he is the video's account
  const account = video.VideoChannel.Account
  if (user.hasRight(right) === false && account.userId !== user.id) {
    res.status(403)
       .json({ error: 'Cannot manage a video of another user.' })
       .end()
    return false
  }

  return true
}

// ---------------------------------------------------------------------------

export {
  doesVideoChannelOfAccountExist,
  doesVideoExist,
  checkUserCanManageVideo
}
