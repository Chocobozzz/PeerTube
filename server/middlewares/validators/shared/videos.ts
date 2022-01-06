import { Request, Response } from 'express'
import { loadVideo, VideoLoadType } from '@server/lib/model-loaders'
import { authenticatePromiseIfNeeded } from '@server/middlewares/auth'
import { VideoModel } from '@server/models/video/video'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { VideoFileModel } from '@server/models/video/video-file'
import {
  MUser,
  MUserAccountId,
  MVideo,
  MVideoAccountLight,
  MVideoFormattableDetails,
  MVideoFullLight,
  MVideoId,
  MVideoImmutable,
  MVideoThumbnail,
  MVideoWithRights
} from '@server/types/models'
import { HttpStatusCode, UserRight } from '@shared/models'

async function doesVideoExist (id: number | string, res: Response, fetchType: VideoLoadType = 'all') {
  const userId = res.locals.oauth ? res.locals.oauth.token.User.id : undefined

  const video = await loadVideo(id, fetchType, userId)

  if (video === null) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video not found'
    })
    return false
  }

  switch (fetchType) {
    case 'for-api':
      res.locals.videoAPI = video as MVideoFormattableDetails
      break

    case 'all':
      res.locals.videoAll = video as MVideoFullLight
      break

    case 'only-immutable-attributes':
      res.locals.onlyImmutableVideo = video as MVideoImmutable
      break

    case 'id':
      res.locals.videoId = video as MVideoId
      break

    case 'only-video':
      res.locals.onlyVideo = video as MVideoThumbnail
      break
  }

  return true
}

async function doesVideoFileOfVideoExist (id: number, videoIdOrUUID: number | string, res: Response) {
  if (!await VideoFileModel.doesVideoExistForVideoFile(id, videoIdOrUUID)) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'VideoFile matching Video not found'
    })
    return false
  }

  return true
}

async function doesVideoChannelOfAccountExist (channelId: number, user: MUserAccountId, res: Response) {
  const videoChannel = await VideoChannelModel.loadAndPopulateAccount(channelId)

  if (videoChannel === null) {
    res.fail({ message: 'Unknown video "video channel" for this instance.' })
    return false
  }

  // Don't check account id if the user can update any video
  if (user.hasRight(UserRight.UPDATE_ANY_VIDEO) === true) {
    res.locals.videoChannel = videoChannel
    return true
  }

  if (videoChannel.Account.id !== user.Account.id) {
    res.fail({
      message: 'Unknown video "video channel" for this account.'
    })
    return false
  }

  res.locals.videoChannel = videoChannel
  return true
}

async function checkCanSeeVideoIfPrivate (req: Request, res: Response, video: MVideo, authenticateInQuery = false) {
  if (!video.requiresAuth()) return true

  const videoWithRights = await VideoModel.loadAndPopulateAccountAndServerAndTags(video.id)

  return checkCanSeePrivateVideo(req, res, videoWithRights, authenticateInQuery)
}

async function checkCanSeePrivateVideo (req: Request, res: Response, video: MVideoWithRights, authenticateInQuery = false) {
  await authenticatePromiseIfNeeded(req, res, authenticateInQuery)

  const user = res.locals.oauth ? res.locals.oauth.token.User : null

  // Only the owner or a user that have blocklist rights can see the video
  if (!user || !user.canGetVideo(video)) {
    return false
  }

  return true
}

function checkUserCanManageVideo (user: MUser, video: MVideoAccountLight, right: UserRight, res: Response, onlyOwned = true) {
  // Retrieve the user who did the request
  if (onlyOwned && video.isOwned() === false) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot manage a video of another server.'
    })
    return false
  }

  // Check if the user can delete the video
  // The user can delete it if he has the right
  // Or if s/he is the video's account
  const account = video.VideoChannel.Account
  if (user.hasRight(right) === false && account.userId !== user.id) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot manage a video of another user.'
    })
    return false
  }

  return true
}

// ---------------------------------------------------------------------------

export {
  doesVideoChannelOfAccountExist,
  doesVideoExist,
  doesVideoFileOfVideoExist,
  checkUserCanManageVideo,
  checkCanSeeVideoIfPrivate,
  checkCanSeePrivateVideo
}
