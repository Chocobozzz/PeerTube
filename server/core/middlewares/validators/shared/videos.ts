import { HttpStatusCode, ServerErrorCode, UserRight, UserRightType, VideoPrivacy } from '@peertube/peertube-models'
import { exists } from '@server/helpers/custom-validators/misc.js'
import { VideoLoadType, loadVideo } from '@server/lib/model-loaders/index.js'
import { isUserQuotaValid } from '@server/lib/user.js'
import { VideoTokensManager } from '@server/lib/video-tokens-manager.js'
import { authenticateOrFail } from '@server/middlewares/auth.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { VideoPasswordModel } from '@server/models/video/video-password.js'
import { VideoModel } from '@server/models/video/video.js'
import {
  MUserAccountId,
  MUserAccountUrl,
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
import { checkCanManageChannel } from './video-channels.js'

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
    res.sendStatus(HttpStatusCode.NOT_FOUND_404)
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
  videoFileToken?: {
    user: MUserAccountUrl
  }
}) {
  const { req, res, video, videoFileToken, paramId } = options

  if (video.requiresUserAuth({ urlParamId: paramId, checkBlacklist: true })) {
    return checkCanSeeUserAuthVideo({ req, res, video, videoFileTokenUser: videoFileToken?.user })
  }

  if (video.privacy === VideoPrivacy.PASSWORD_PROTECTED) {
    return checkCanSeePasswordProtectedVideo({ req, res, video, hasVideoFileToken: !!videoFileToken })
  }

  if (video.privacy === VideoPrivacy.UNLISTED || video.privacy === VideoPrivacy.PUBLIC || video.privacy === VideoPrivacy.PREMIERE) {
    return true
  }

  throw new Error('Unknown video privacy when checking video right ' + video.url)
}

async function checkCanSeeUserAuthVideo (options: {
  req: Request
  res: Response
  video: MVideoId | MVideoWithRights
  videoFileTokenUser?: MUserAccountUrl
}) {
  const { req, res, video } = options

  const fail = () => {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: req.t('Cannot fetch information of private/internal/blocked video')
    })

    return false
  }

  let user = options.videoFileTokenUser
  if (!user) {
    if (!await authenticateOrFail({ req, res })) return false

    user = res.locals.oauth.token.User
  }

  const videoWithRights = await getVideoWithRights(video as MVideoWithRights)

  const privacy = videoWithRights.privacy

  if (privacy === VideoPrivacy.INTERNAL) {
    // We know we have a user
    return true
  }

  if (videoWithRights.isBlacklisted()) {
    if (await canUserManageProtectedVideo({ user, req, video: videoWithRights, right: UserRight.MANAGE_VIDEO_BLACKLIST })) return true

    return fail()
  }

  if (privacy === VideoPrivacy.PRIVATE || privacy === VideoPrivacy.UNLISTED) {
    if (await canUserManageProtectedVideo({ user, req, video: videoWithRights, right: UserRight.SEE_ALL_VIDEOS })) return true

    return fail()
  }

  // Should not happen
  return fail()
}

async function checkCanSeePasswordProtectedVideo (options: {
  req: Request
  res: Response
  video: MVideo
  hasVideoFileToken: boolean
}) {
  const { req, res, video, hasVideoFileToken } = options

  const videoWithRights = await getVideoWithRights(video as MVideoWithRights)

  const videoPassword = req.header('x-peertube-video-password')

  if (!exists(videoPassword)) {
    if (hasVideoFileToken === true) return true

    const errorMessage = req.t('Please provide a password to access this password protected video')
    const errorType = ServerErrorCode.VIDEO_REQUIRES_PASSWORD

    if (!await authenticateOrFail({ req, res, errorMessage, errorStatus: HttpStatusCode.UNAUTHORIZED_401, errorType })) return false

    const user = res.locals.oauth.token.User

    if (await canUserManageProtectedVideo({ user, req, video: videoWithRights, right: UserRight.SEE_ALL_VIDEOS })) return true

    res.fail({
      status: user
        ? HttpStatusCode.FORBIDDEN_403
        : HttpStatusCode.UNAUTHORIZED_401,

      type: errorType,
      message: errorMessage
    })
    return false
  }

  if (await VideoPasswordModel.isACorrectPassword({ videoId: video.id, password: videoPassword })) return true

  res.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    type: ServerErrorCode.INCORRECT_VIDEO_PASSWORD,
    message: req.t('Incorrect video password. Access to the video is denied')
  })

  return false
}

async function canUserManageProtectedVideo (options: {
  req: Request
  user: MUserAccountId
  video: MVideoWithRights | MVideoAccountLight
  right: UserRightType
}) {
  const { user, video, right, req } = options

  return checkCanManageChannel({
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
}): Promise<boolean> {
  const { video, req, res } = options

  if (!checkVideoTokenIfNeeded(req, res, video)) return false

  return checkCanSeeVideo({ ...options, videoFileToken: res.locals.videoFileToken })
}

export async function checkCanAccessVideoSourceFile (options: {
  videoId: number
  req: Request
  res: Response
}): Promise<boolean> {
  const { req, res, videoId } = options

  const video = await VideoModel.loadFull(videoId)

  let user = res.locals.oauth?.token.User
  if (!user) {
    if (!checkVideoTokenIfNeeded(req, res, video)) return false

    user = res.locals.videoFileToken?.user
  }

  if (!user) {
    res.fail({ status: HttpStatusCode.UNAUTHORIZED_401, message: req.t('Authentication is required to access the video source file') })
    return false
  }

  if (await canUserManageProtectedVideo({ user, req, video, right: UserRight.SEE_ALL_VIDEOS }) === true) {
    return true
  }

  res.sendStatus(HttpStatusCode.FORBIDDEN_403)
  return false
}

function checkVideoTokenIfNeeded (req: Request, res: Response, video: MVideoUUID) {
  const videoFileToken = req.query.videoFileToken

  if (videoFileToken) {
    if (VideoTokensManager.Instance.hasToken({ token: videoFileToken, videoUUID: video.uuid })) {
      const user = VideoTokensManager.Instance.getUserFromToken({ token: videoFileToken })

      res.locals.videoFileToken = { user }
    } else {
      res.fail({
        message: req.t('Invalid video file token'),
        status: HttpStatusCode.FORBIDDEN_403
      })

      return false
    }
  }

  return true
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
    !await checkCanManageChannel({
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

type NewType = MUserId

// ---------------------------------------------------------------------------

export async function checkUserQuota (options: {
  user: NewType
  videoFileSize: number
  req: Request
  res: Response
}) {
  const { user, videoFileSize, req, res } = options

  if (await isUserQuotaValid({ userId: user.id, uploadSize: videoFileSize }) === false) {
    res.fail({
      status: HttpStatusCode.PAYLOAD_TOO_LARGE_413,
      message: req.t('The user video quota is exceeded with this video'),
      type: ServerErrorCode.QUOTA_REACHED
    })
    return false
  }

  return true
}
