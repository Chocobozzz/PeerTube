import { arrayify } from '@peertube/peertube-core-utils'
import { HttpStatusCode, UserRight, VideoCommentPolicy } from '@peertube/peertube-models'
import { isStringArray } from '@server/helpers/custom-validators/search.js'
import { canVideoBeFederated } from '@server/lib/activitypub/videos/federate.js'
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
  checkCanSeeVideo,
  checkUserCanManageAccount,
  checkUserCanManageVideo,
  doesVideoChannelIdExist,
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
    if (req.query.videoChannelId && !await doesVideoChannelIdExist(req.query.videoChannelId, res)) return

    return next()
  }
]

export const listCommentsOnUserVideosValidator = [
  ...getCommonVideoCommentsValidators(),

  query('isHeldForReview')
    .optional()
    .customSanitizer(toBooleanOrNull)
    .custom(isBooleanValid)
    .withMessage('Should have a valid isHeldForReview boolean'),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return

    if (req.query.videoId && !await doesVideoExist(req.query.videoId, res, 'all')) return
    if (req.query.videoChannelId && !await doesVideoChannelIdExist(req.query.videoChannelId, res)) return

    const user = res.locals.oauth.token.User

    const video = res.locals.videoAll
    if (video && !checkUserCanManageVideo(user, video, UserRight.SEE_ALL_COMMENTS, res)) return

    const channel = res.locals.videoChannel
    if (channel && !checkUserCanManageAccount({ account: channel.Account, user, res, specialRight: UserRight.SEE_ALL_COMMENTS })) return

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

    if (!checkUserCanDeleteVideoComment(res.locals.oauth.token.User, res.locals.videoCommentFull, res)) return

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

    if (!checkUserCanApproveVideoComment(res.locals.oauth.token.User, res.locals.videoCommentFull, res)) return

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

function checkUserCanDeleteVideoComment (user: MUserAccountUrl, videoComment: MCommentOwnerVideoReply, res: express.Response) {
  if (videoComment.isDeleted()) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'This comment is already deleted'
    })
    return false
  }

  return checkUserCanManageVideoComment(user, videoComment, res)
}

function checkUserCanApproveVideoComment (user: MUserAccountUrl, videoComment: MCommentOwnerVideoReply, res: express.Response) {
  if (videoComment.isDeleted()) {
    res.fail({
      status: HttpStatusCode.CONFLICT_409,
      message: 'This comment is deleted'
    })
    return false
  }

  if (videoComment.heldForReview !== true) {
    res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: 'This comment is not held for review'
    })
    return false
  }

  return checkUserCanManageVideoComment(user, videoComment, res)
}

function checkUserCanManageVideoComment (user: MUserAccountUrl, videoComment: MCommentOwnerVideoReply, res: express.Response) {
  const userAccount = user.Account

  if (
    user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT) === false && // Not a moderator
    videoComment.accountId !== userAccount.id && // Not the comment owner
    videoComment.Video.VideoChannel.accountId !== userAccount.id // Not the video owner
  ) {
    res.fail({
      status: HttpStatusCode.FORBIDDEN_403,
      message: 'Cannot remove video comment of another user'
    })
    return false
  }

  return true
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

  if (!acceptedResult || acceptedResult.accepted !== true) {
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
