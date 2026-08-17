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
  toArray,
  toBooleanOrNull,
  toCompleteUUID,
  toIntOrNull
} from '../../../helpers/custom-validators/misc.js'
import { isValidVideoCommentText } from '../../../helpers/custom-validators/video-comments.js'
import { createLogger } from '../../../helpers/logger.js'
import { VIDEO_COMMENTS_TREE } from '../../../initializers/constants.js'
import { AcceptResult, isLocalVideoCommentReplyAccepted, isLocalVideoThreadAccepted } from '../../../lib/moderation.js'
import { Hooks } from '../../../lib/plugins/hooks.js'
import { MCommentOwnerVideoReply, MVideo, MVideoAccountLight } from '../../../types/models/video/index.js'
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

const logger = createLogger()

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

    if (req.query.videoId && !await doesVideoExist(req.query.videoId, res, 'unsafe-immutable-only')) return
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

    if (req.query.videoId && !await doesVideoExist(req.query.videoId, res, 'with-rights')) return

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

    const video = res.locals.videoWithRights
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
    if (!await doesVideoExist(req.params.videoId, res, 'with-blacklist')) return

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.videoId, video: res.locals.videoWithBlacklist })) return

    return next()
  }
]

export const listVideoThreadCommentsValidator = [
  isValidVideoIdParam('videoId'),

  param('threadId').custom(isIdValid),

  ...getCommentTreeValidators(),

  isValidVideoPasswordHeader(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!checkCommentTreeSearchedComments(req, res, { useCountParam: false })) return
    if (!await doesVideoExist(req.params.videoId, res, 'with-blacklist')) return
    if (!await doesVideoCommentThreadExist(req.params.threadId, res.locals.videoWithBlacklist, res)) return

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.videoId, video: res.locals.videoWithBlacklist })) return

    return next()
  }
]

export const listVideoCommentRepliesValidator = [
  isValidVideoIdParam('videoId'),

  param('commentId').custom(isIdValid),

  ...getCommentTreeValidators(),

  isValidVideoPasswordHeader(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!checkCommentTreeSearchedComments(req, res, { useCountParam: true })) return
    if (!await doesVideoExist(req.params.videoId, res, 'with-blacklist')) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoWithBlacklist, res)) return

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.videoId, video: res.locals.videoWithBlacklist })) return

    return next()
  }
]

function getCommentTreeValidators () {
  return [
    query('maxDepth')
      .optional()
      .customSanitizer(toIntOrNull)
      .isInt({ min: 1, max: VIDEO_COMMENTS_TREE.DEPTH.MAX }),

    query('repliesPerLevel')
      .optional()
      .customSanitizer(toIntOrNull)
      .isInt({ min: 1, max: VIDEO_COMMENTS_TREE.REPLIES_PER_LEVEL.MAX })
  ]
}

// maxDepth and repliesPerLevel are valid on their own but multiply each other, so we also have to check
// how many comments the database may have to walk through to build the tree
function checkCommentTreeSearchedComments (req: express.Request, res: express.Response, options: { useCountParam: boolean }) {
  const { useCountParam } = options

  const maxDepth = req.query.maxDepth ?? VIDEO_COMMENTS_TREE.DEPTH.DEFAULT
  const repliesPerLevel = req.query.repliesPerLevel ?? VIDEO_COMMENTS_TREE.REPLIES_PER_LEVEL.DEFAULT
  // The thread endpoint is not paginated (it always fetches `repliesPerLevel` comments on its first level)
  // and does not have a pagination validator, so `count` is only meaningful (and validated) on the replies endpoint
  const count = useCountParam
    ? req.query.count
    : repliesPerLevel

  const searchedComments = repliesPerLevel === 1
    ? count * maxDepth
    : count * (Math.pow(repliesPerLevel, maxDepth) - 1) / (repliesPerLevel - 1)

  if (searchedComments <= VIDEO_COMMENTS_TREE.MAX_SEARCHED_COMMENTS) return true

  res.fail({
    message: `This combination of count, repliesPerLevel and maxDepth could search up to ${Math.round(searchedComments)} comments, ` +
      `and the maximum is ${VIDEO_COMMENTS_TREE.MAX_SEARCHED_COMMENTS}. Decrease maxDepth or repliesPerLevel`
  })

  return false
}

// ---------------------------------------------------------------------------

export const addVideoCommentThreadValidator = [
  isValidVideoIdParam('videoId'),

  body('text')
    .custom(isValidVideoCommentText),
  isValidVideoPasswordHeader(),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'with-rights')) return

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.videoId, video: res.locals.videoWithRights })) return

    if (!isVideoCommentsEnabled(res.locals.videoWithRights, res)) return
    if (!await isVideoCommentAccepted(req, res, res.locals.videoWithRights, false)) return

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
    if (!await doesVideoExist(req.params.videoId, res, 'with-rights')) return

    if (!await checkCanSeeVideo({ req, res, paramId: req.params.videoId, video: res.locals.videoWithRights })) return

    if (!isVideoCommentsEnabled(res.locals.videoWithRights, res)) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoWithRights, res)) return
    if (!await isVideoCommentAccepted(req, res, res.locals.videoWithRights, true)) return

    return next()
  }
]

export const videoCommentGetValidator = [
  isValidVideoIdParam('videoId'),

  param('commentId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'with-blacklist')) return

    if (!canVideoBeFederated(res.locals.videoWithBlacklist)) return res.sendStatus(HttpStatusCode.NOT_FOUND_404)

    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoWithBlacklist, res)) return

    return next()
  }
]

export const removeVideoCommentValidator = [
  isValidVideoIdParam('videoId'),

  param('commentId')
    .custom(isIdValid),

  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (areValidationErrors(req, res)) return
    if (!await doesVideoExist(req.params.videoId, res, 'unsafe-immutable-only')) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoImmutable, res)) return

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
    if (!await doesVideoExist(req.params.videoId, res, 'unsafe-immutable-only')) return
    if (!await doesVideoCommentExist(req.params.commentId, res.locals.videoImmutable, res)) return

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

async function isVideoCommentAccepted (req: express.Request, res: express.Response, video: MVideoAccountLight, isReply: boolean) {
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
      .customSanitizer(toArray)
      .custom(isStringArray).withMessage('Should have a valid autoTagOneOf array'),

    query('includeMuted')
      .optional()
      .customSanitizer(toBooleanOrNull)
      .custom(isBooleanValid)
      .withMessage('Should have a valid includeMuted boolean')
  ]
}
