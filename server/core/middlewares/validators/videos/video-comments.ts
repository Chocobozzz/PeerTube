import { arrayify } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRight, VideoCommentPolicy } from '@peertube/peertube-models'
import { isStringArray } from '@server/helpers/custom-validators/search.js'
import { canVideoBeFederated } from '@server/lib/activitypub/videos/federate.js'
import { VideoChannelModel } from '@server/models/video/video-channel.js'
import { MUserAccountUrl } from '@server/types/models/index.js'
import express from 'express'
import { body, param, query } from 'express-validator'
import {
  exists,
  isBooleanValid,
  isIdOrUUIDValid,
  isIdValid,
  toBooleanOrNull,
  toCompleteUUID,
  toIntOrNull
} from '../../../helpers/custom-validators/misc.js'
import { isValidVideoCommentText } from '../../../helpers/custom-validators/video-comments.js'
import { logger } from '../../../helpers/logger.js'
import { AcceptResult, isLocalVideoCommentReplyAccepted, isLocalVideoThreadAccepted } from '../../../lib/moderation.js'
import { Hooks } from '../../../lib/plugins/hooks.js'
import { MCommentOwnerVideoReply, MVideo, MVideoFullLight } from '../../../types/models/video/index.js'
import {
  areValidationErrors,
  checkCanManageChannel,
  checkCanManageVideo,
  checkCanSeeVideo,
  doesChannelIdExist,
  doesVideoCommentExist,
  doesVideoCommentThreadExist,
  doesVideoExist,
  isValidVideoIdParam,
  isValidVideoPasswordHeader
} from '../shared/index.js'

export const listAllVideoCommentsForAdminValidator = [
  ...getCommonVideoCommentsValidators(),

  query('isLocal')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid)
    .withMessage('Should have a valid isLocal boolean'),

  query('onLocalVideo')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid)
    .withMessage('Should have a valid onLocalVideo boolean'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (req.query.videoId && !await doesVideoExist(req.query.videoId, res, 'unsafe-only-immutable-attributes')) return
    if (
      req.query.videoChannelId &&
      !await doesChannelIdExist({ id: req.query.videoChannelId, checkCanManage: true, checkIsOwner: false, checkIsLocal: true, req, res })
    ) return

    return next()
  }
]

export const listCommentsOnUserVideosValidator = [
  ...getCommonVideoCommentsValidators(),

  query('isHeldForReview')
    .optional()
    .customSanitizer(toBooleanOrNull),

  query('includeCollaborations')
    .optional()
    .customSanitizer(toBooleanOrNull),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (req.query.videoId && !await doesVideoExist(req.query.videoId, res, 'all')) return

    if (
      req.query.videoChannelId &&
      !await doesChannelIdExist({
        id: req.query.videoChannelId,
        checkCanManage: true,
        checkIsLocal: true,
        checkIsOwner: false,
        req,
        res,
        specialRight: UserRight.SEE_ALL_COMMENTS
      })
    ) return

    const user = res.locals.oauth.token.User

    const video = res.locals.videoAll
    if (
      video &&
      !await checkCanManageVideo({ user, video, right: UserRight.SEE_ALL_COMMENTS, req, res, checkIsLocal: true, checkIsOwner: false })
    ) return

    return next()
  }
]

// ---------------------------------------------------------------------------

export const listVideoCommentThreadsValidator = [
  isValidVideoIdParam('videoId'),
  isValidVideoPasswordHeader(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'only-video-and-blacklist')) return

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.videoId, video: res.locals.onlyVideo })) return

    return next()
  }
]

export const listVideoThreadCommentsValidator = [
  isValidVideoIdParam('videoId'),

  param('threadId')
    .custom(isIdValid),
  isValidVideoPasswordHeader(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'only-video-and-blacklist')) return
    if (!await doesVideoCommentThreadExist(req.params.threadId, res.locals.onlyVideo, res)) return

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.videoId, video: res.locals.onlyVideo })) return

    return next()
  }
]

export const addVideoCommentThreadValidator = [
  isValidVideoIdParam('videoId'),

  body('text')
    .custom(isValidVideoCommentText),
  isValidVideoPasswordHeader(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.videoId, video: res.locals.videoAll })) return

    if (!isVideoCommentsEnabled(res.locals.videoAll, res)) return
    if (!await isVideoCommentAccepted(req, res, res.locals.videoAll, false)) return

    return next()
  }
]

export const addVideoCommentReplyValidator = [
  isValidVideoIdParam('videoId'),

  param('commentId').custom(isIdValid),
  isValidVideoPasswordHeader(),

  body('text').custom(isValidVideoCommentText),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.videoId, video: res.locals.videoAll })) return

    if (!isVideoCommentsEnabled(res.locals.videoAll, res)) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoAll, res)) return
    if (!await isVideoCommentAccepted(req, res, res.locals.videoAll, true)) return

    return next()
  }
]

export const videoCommentGetValidator = [
  isValidVideoIdParam('videoId'),

  param('commentId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'only-video-and-blacklist')) return

    if (!canVideoBeFederated(res.locals.onlyVideo)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    if (!await doesVideoCommentExist(req.params.commentId, res.locals.onlyVideo, res)) return

    return next()
  }
]

export const removeVideoCommentValidator = [
  isValidVideoIdParam('videoId'),

  param('commentId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoAll, res)) return

    if (!await checkCanDeleteVideoComment({ user: res.locals.oauth.token.User, videoComment: res.locals.videoCommentFull, req, res })) {
      return
    }

    return next()
  }
]

export const approveVideoCommentValidator = [
  isValidVideoIdParam('videoId'),

  param('commentId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res)) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoAll, res)) return

    if (!await checkCanApproveVideoComment({ user: res.locals.oauth.token.User, videoComment: res.locals.videoCommentFull, req, res })) {
      return
    }

    return next()
  }
]

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function isVideoCommentsEnabled (video: MVideo, res: express.Response) {
  if (video.commentsPolicy === VideoCommentPolicy.DISABLED) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'Video comments are disabled for this video.'
    })
    return false
  }

  return true
}

function checkCanDeleteVideoComment (options: {
  user: MUserAccountUrl
  videoComment: MCommentOwnerVideoReply
  req: express.Request
  res: express.Response
}): Promise<boolean> {
  const { user, videoComment, req, res } = options

  if (videoComment.isDeleted()) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: req.t('This comment is already deleted')
    })
    return Promise.resolve(false)
  }

  // Owner of the comment
  if (videoComment.accountId === user.Account.id) {
    return Promise.resolve(true)
  }

  return checkCanManageCommentsOfVideo(options)
}

function checkCanApproveVideoComment (options: {
  user: MUserAccountUrl
  videoComment: MCommentOwnerVideoReply
  req: express.Request
  res: express.Response
}): Promise<boolean> {
  const { user, videoComment, req, res } = options

  if (videoComment.isDeleted()) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: req.t('This comment is deleted')
    })
    return Promise.resolve(false)
  }

  if (videoComment.heldForReview !== true) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: req.t('This comment is not held for review')
    })
    return Promise.resolve(false)
  }

  return checkCanManageCommentsOfVideo({ user, videoComment, req, res })
}

async function checkCanManageCommentsOfVideo (options: {
  user: MUserAccountUrl
  videoComment: MCommentOwnerVideoReply
  req: express.Request
  res: express.Response
}) {
  const { user, videoComment, req, res } = options

  if (user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)) return true

  const channel = await VideoChannelModel.loadAndPopulateAccount(videoComment.Video.VideoChannel.id)
  if (await checkCanManageChannel({ channel, user, req, res: null, checkCanManage: true, checkIsOwner: false })) return true

  res.fail({
    status: HttpStatusCode.FORBIDDEN_403,
    message: req.t('User does not have the permission to delete this comment')
  })

  return false
}

async function isVideoCommentAccepted (req: express.Request, res: express.Response, video: MVideoFullLight, isReply: boolean) {
  const acceptParameters = {
    video,
    commentBody: req.body,
    user: res.locals.oauth.token.User,
    req
  }

  let acceptedResult: AcceptResult

  if (isReply) {
    const acceptReplyParameters = Object.assign(acceptParameters, { parentComment: res.locals.videoCommentFull })

    acceptedResult = await Hooks.wrapFun(
      isLocalVideoCommentReplyAccepted,
      acceptReplyParameters,
      'filter:api.video-comment-reply.create.accept.result'
    )
  } else {
    acceptedResult = await Hooks.wrapFun(
      isLocalVideoThreadAccepted,
      acceptParameters,
      'filter:api.video-thread.create.accept.result'
    )
  }

  if (acceptedResult?.accepted !== true) {
    logger.info('Refused local comment.', { acceptedResult, acceptParameters })

    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: acceptedResult?.errorMessage || 'Comment has been rejected.'
    })
    return false
  }

  return true
}

function getCommonVideoCommentsValidators () {
  return [
    query('search')
      .optional()
      .custom(exists),

    query('searchAccount')
      .optional()
      .custom(exists),

    query('searchVideo')
      .optional()
      .custom(exists),

    query('videoId')
      .optional()
      .custom(toCompleteUUID)
      .custom(isIdOrUUIDValid),

    query('videoChannelId')
      .optional()
      .customSanitizer(toIntOrNull)
      .custom(isIdValid),

    query('autoTagOneOf')
      .optional()
      .customSanitizer(arrayify)
      .custom(isStringArray).withMessage('Should have a valid autoTagOneOf array')
  ]
}
