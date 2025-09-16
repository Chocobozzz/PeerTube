import { HttpStatusCode, ServerErrorCode, UserRight, UserRightType, VideoPrivacy } from '@peertube/peertube-models'
import { exists } from '@server/helpers/custom-validators/misc.js'
import { VideoLoadType, loadVideo } from '@server/lib/model-loaders/index.js'
import { isUserQuotaValid } from '@server/lib/user.js'
import { VideoTokensManager } from '@server/lib/video-tokens-manager.js'
import { authenticatePromise } from '@server/middlewares/auth.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { VideoModel } from '@server/models/video/video.js'
import {
  MUserAccountId,
  MUserId,
  MVideo,
  MVideoAccountLight,
  MVideoFormattableDetails,
  MVideoFullLight,
  MVideoId,
  MVideoImmutable,
  MVideoThumbnailBlacklist,
  MVideoUUID,
  MVideoWithRights
} from '@server/types/models/index.js'
import { Request, Response } from 'express'
import { canManageChannel } from './video-channels.js'

export async function doesVideoExist (id: number | string, res: Response, fetchType: VideoLoadType = 'all') {
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

    case 'unsafe-only-immutable-attributes':
      res.locals.onlyImmutableVideo = video as MVideoImmutable
      break

    case 'id':
      res.locals.videoId = video as MVideoId
      break

    case 'only-video-and-blacklist':
      res.locals.onlyVideo = video as MVideoThumbnailBlacklist
      break
  }

  return true
}

// ---------------------------------------------------------------------------

export async function doesVideoFileOfVideoExist (id: number, videoIdOrUUID: number | string, res: Response) {
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

export async function checkCanSeeVideo (options: {
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
      message: req.t('Cannot fetch information of private/internal/blocked video')
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
    if (await canUserAccessVideo({ user, req, video: videoWithRights, right: UserRight.MANAGE_VIDEO_BLACKLIST })) return true

    return fail()
  }

  if (privacy === VideoPrivacy.PRIVATE || privacy === VideoPrivacy.UNLISTED) {
    if (await canUserAccessVideo({ user, req, video: videoWithRights, right: UserRight.SEE_ALL_VIDEOS })) return true

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

      if (await canUserAccessVideo({ user, req, video: videoWithRights, right: UserRight.SEE_ALL_VIDEOS })) return true
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

async function canUserAccessVideo (options: {
  req: Request
  user: MUserAccountId
  video: MVideoWithRights | MVideoAccountLight
  right: UserRightType
}) {
  const { user, video, right, req } = options

  return canManageChannel({
    channel: video.VideoChannel,
    user,
    req,
    res: null,
    checkCanManage: true,
    checkIsOwner: false,
    specialRight: right
  })
}

async function getVideoWithRights (video: MVideoWithRights): Promise<MVideoWithRights> {
  const channel = video.VideoChannel

  if (channel?.id && channel?.Account?.userId && channel?.Account?.id) return video

  return VideoModel.loadFull(video.id)
}

// ---------------------------------------------------------------------------

export async function checkCanAccessVideoStaticFiles (options: {
  video: MVideo
  req: Request
  res: Response
  paramId: string
}) {
  const { video, req, res } = options

  if (res.locals.oauth?.token.User || exists(req.header('x-peertube-video-password'))) {
    return checkCanSeeVideo(options)
  }

  assignVideoTokenIfNeeded(req, res, video)

  if (res.locals.videoFileToken) return true
  if (!video.hasPrivateStaticPath()) return true

  res.sendStatus(HttpStatusCode.FORBIDDEN_403)
  return false
}

export async function checkCanAccessVideoSourceFile (options: {
  videoId: number
  req: Request
  res: Response
}) {
  const { req, res, videoId } = options

  const video = await VideoModel.loadFull(videoId)

  if (res.locals.oauth?.token.User) {
    if (await canUserAccessVideo({ user: res.locals.oauth.token.User, req, video, right: UserRight.SEE_ALL_VIDEOS }) === true) return true

    res.sendStatus(HttpStatusCode.FORBIDDEN_403)
    return false
  }

  assignVideoTokenIfNeeded(req, res, video)
  if (res.locals.videoFileToken) return true

  res.sendStatus(HttpStatusCode.FORBIDDEN_403)
  return false
}

function assignVideoTokenIfNeeded (req: Request, res: Response, video: MVideoUUID) {
  const videoFileToken = req.query.videoFileToken

  if (videoFileToken && VideoTokensManager.Instance.hasToken({ token: videoFileToken, videoUUID: video.uuid })) {
    const user = VideoTokensManager.Instance.getUserFromToken({ token: videoFileToken })

    res.locals.videoFileToken = { user }
  }
}

// ---------------------------------------------------------------------------

export async function checkCanManageVideo (options: {
  user: MUserAccountId
  video: MVideoAccountLight
  right: UserRightType
  req: Request
  res: Response | null
  checkIsLocal: boolean
  checkIsOwner: boolean
}) {
  const { user, video, right, req, res, checkIsLocal, checkIsOwner } = options

  if (!user) {
    res?.fail({
      status: HttpStatusCode.UNAUTHORIZED_401,
      message: req.t('Authentication is required.')
    })
    return false
  }

  if (checkIsLocal && video.isLocal() === false) {
    res?.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('Cannot manage a video of another server.')
    })
    return false
  }

  if (
    !await canManageChannel({
      channel: video.VideoChannel,
      user,
      req,
      res: null,
      checkCanManage: true,
      checkIsOwner,
      specialRight: right
    })
  ) {
    res?.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('Cannot manage a video of another user.')
    })
    return false
  }

  return true
}

// ---------------------------------------------------------------------------

export async function checkUserQuota (user: MUserId, videoFileSize: number, res: Response) {
  if (await isUserQuotaValid({ userId: user.id, uploadSize: videoFileSize }) === false) {
    res.fail({
      status: HttpStatusCode.PAYLOAD_TOO_LARGE_413,
      message: 'The user video quota is exceeded with this video.',
      type: ServerErrorCode.QUOTA_REACHED
    })
    return false
  }

  return true
}
