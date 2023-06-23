import { Request, Response } from 'express'
import { loadVideo, VideoLoadType } from '@server/lib/model-loaders'
import { isAbleToUploadVideo } from '@server/lib/user'
import { VideoTokensManager } from '@server/lib/video-tokens-manager'
import { authenticatePromise } from '@server/middlewares/auth'
import { VideoModel } from '@server/models/video/video'
import { VideoChannelModel } from '@server/models/video/video-channel'
import { VideoFileModel } from '@server/models/video/video-file'
import {
  MUser,
  MUserAccountId,
  MUserId,
  MVideo,
  MVideoAccountLight,
  MVideoFormattableDetails,
  MVideoFullLight,
  MVideoId,
  MVideoImmutable,
  MVideoThumbnail,
  MVideoWithRights
} from '@server/types/models'
import { HttpStatusCode, ServerErrorCode, UserRight, VideoPrivacy } from '@shared/models'
import { VideoPasswordModel } from '@server/models/video/video-password'
import { exists } from '@server/helpers/custom-validators/misc'

async function doesVideoExist (id: number | string, res: Response, fetchType: VideoLoadType = 'all') {
  const userId = res.locals.oauth ? res.locals.oauth.token.User.id : undefined

  const video = await loadVideo(id, fetchType, userId)

  if (!video) {
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

// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------

async function checkCanSeeVideo (options: {
  req: Request
  res: Response
  paramId: string
  video: MVideo
}) {
  const { req, res, video, paramId } = options

  if (video.requiresUserAuth({ urlParamId: paramId, checkBlacklist: true })) {
    return checkCanSeeUserAuthVideo({ req, res, video })
  }

  if (video.privacy === VideoPrivacy.PASSWORD_PROTECTED) {
    return checkCanSeePasswordProtectedVideo({ req, res, video })
  }

  if (video.privacy === VideoPrivacy.UNLISTED || video.privacy === VideoPrivacy.PUBLIC) {
    return true
  }

  throw new Error('Unknown video privacy when checking video right ' + video.url)
}

async function checkCanSeeUserAuthVideo (options: {
  req: Request
  res: Response
  video: MVideoId | MVideoWithRights
}) {
  const { req, res, video } = options

  const fail = () => {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot fetch information of private/internal/blocked video'
    })

    return false
  }

  await authenticatePromise({ req, res })

  const user = res.locals.oauth?.token.User
  if (!user) return fail()

  const videoWithRights = await getVideoWithRights(video as MVideoWithRights)

  const privacy = videoWithRights.privacy

  if (privacy === VideoPrivacy.INTERNAL) {
    // We know we have a user
    return true
  }

  if (videoWithRights.isBlacklisted()) {
    if (canUserAccessVideo(user, videoWithRights, UserRight.MANAGE_VIDEO_BLACKLIST)) return true

    return fail()
  }

  if (privacy === VideoPrivacy.PRIVATE || privacy === VideoPrivacy.UNLISTED) {
    if (canUserAccessVideo(user, videoWithRights, UserRight.SEE_ALL_VIDEOS)) return true

    return fail()
  }

  // Should not happen
  return fail()
}

async function checkCanSeePasswordProtectedVideo (options: {
  req: Request
  res: Response
  video: MVideo
}) {
  const { req, res, video } = options

  const videoWithRights = await getVideoWithRights(video as MVideoWithRights)

  const videoPassword = req.header('x-peertube-video-password')

  if (!exists(videoPassword)) {
    const errorMessage = 'Please provide a password to access this password protected video'
    const errorType = ServerErrorCode.VIDEO_REQUIRES_PASSWORD

    if (req.header('authorization')) {
      await authenticatePromise({ req, res, errorMessage, errorStatus: HttpStatusCode.FORBIDDEN_403, errorType })
      const user = res.locals.oauth?.token.User

      if (canUserAccessVideo(user, videoWithRights, UserRight.SEE_ALL_VIDEOS)) return true
    }

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      type: errorType,
      message: errorMessage
    })
    return false
  }

  if (await VideoPasswordModel.isACorrectPassword({ videoId: video.id, password: videoPassword })) return true

  res.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    type: ServerErrorCode.INCORRECT_VIDEO_PASSWORD,
    message: 'Incorrect video password. Access to the video is denied.'
  })

  return false
}

function canUserAccessVideo (user: MUser, video: MVideoWithRights | MVideoAccountLight, right: UserRight) {
  const isOwnedByUser = video.VideoChannel.Account.userId === user.id

  return isOwnedByUser || user.hasRight(right)
}

async function getVideoWithRights (video: MVideoWithRights): Promise<MVideoWithRights> {
  return video.VideoChannel?.Account?.userId
    ? video
    : VideoModel.loadFull(video.id)
}

// ---------------------------------------------------------------------------

async function checkCanAccessVideoStaticFiles (options: {
  video: MVideo
  req: Request
  res: Response
  paramId: string
}) {
  const { video, req, res } = options

  if (res.locals.oauth?.token.User || exists(req.header('x-peertube-video-password'))) {
    return checkCanSeeVideo(options)
  }

  const videoFileToken = req.query.videoFileToken
  if (videoFileToken && VideoTokensManager.Instance.hasToken({ token: videoFileToken, videoUUID: video.uuid })) {
    const user = VideoTokensManager.Instance.getUserFromToken({ token: videoFileToken })

    res.locals.videoFileToken = { user }
    return true
  }

  if (!video.hasPrivateStaticPath()) return true

  res.sendStatus(HttpStatusCode.FORBIDDEN_403)
  return false
}

// ---------------------------------------------------------------------------

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

async function checkUserQuota (user: MUserId, videoFileSize: number, res: Response) {
  if (await isAbleToUploadVideo(user.id, videoFileSize) === false) {
    res.fail({
      status: HttpStatusCode.PAYLOAD_TOO_LARGE_413,
      message: 'The user video quota is exceeded with this video.',
      type: ServerErrorCode.QUOTA_REACHED
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

  checkCanAccessVideoStaticFiles,
  checkUserCanManageVideo,
  checkCanSeeVideo,
  checkUserQuota
}
