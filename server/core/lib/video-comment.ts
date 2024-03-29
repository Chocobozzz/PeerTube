import { AutomaticTagPolicy, ResultList, UserRight, VideoCommentPolicy, VideoCommentThreadTree } from '@peertube/peertube-models'
import { logger } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { AccountModel } from '@server/models/account/account.js'
import { AccountAutomaticTagPolicyModel } from '@server/models/automatic-tag/account-automatic-tag-policy.js'
import express from 'express'
import cloneDeep from 'lodash-es/cloneDeep.js'
import { Transaction } from 'sequelize'
import { VideoCommentModel } from '../models/video/video-comment.js'
import {
  MComment,
  MCommentFormattable,
  MCommentOwnerVideo,
  MCommentOwnerVideoReply, MUserAccountId, MVideoAccountLight,
  MVideoFullLight
} from '../types/models/index.js'
import { sendCreateVideoCommentIfNeeded, sendDeleteVideoComment, sendReplyApproval } from './activitypub/send/index.js'
import { getLocalVideoCommentActivityPubUrl } from './activitypub/url.js'
import { AutomaticTagger } from './automatic-tags/automatic-tagger.js'
import { setAndSaveCommentAutomaticTags } from './automatic-tags/automatic-tags.js'
import { Notifier } from './notifier/notifier.js'
import { Hooks } from './plugins/hooks.js'

export async function removeComment (commentArg: MComment, req: express.Request, res: express.Response) {
  let videoCommentInstanceBefore: MCommentOwnerVideo

  await sequelizeTypescript.transaction(async t => {
    const comment = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideoAndReply(commentArg.url, t)

    videoCommentInstanceBefore = cloneDeep(comment)

    if (comment.isOwned() || comment.Video.isOwned()) {
      await sendDeleteVideoComment(comment, t)
    }

    comment.markAsDeleted()

    await comment.save({ transaction: t })

    logger.info('Video comment %d deleted.', comment.id)
  })

  Hooks.runAction('action:api.video-comment.deleted', { comment: videoCommentInstanceBefore, req, res })
}

export async function approveComment (commentArg: MComment) {
  await sequelizeTypescript.transaction(async t => {
    const comment = await VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(commentArg.id, t)

    const oldHeldForReview = comment.heldForReview

    comment.heldForReview = false
    await comment.save({ transaction: t })

    if (comment.isOwned()) {
      await sendCreateVideoCommentIfNeeded(comment, t)
    } else {
      sendReplyApproval(comment, 'ApproveReply')
    }

    if (oldHeldForReview !== comment.heldForReview) {
      Notifier.Instance.notifyOnNewCommentApproval(comment)
    }

    logger.info('Video comment %d approved.', comment.id)
  })
}

export async function createLocalVideoComment (options: {
  text: string
  inReplyToComment: MComment | null
  video: MVideoFullLight
  user: MUserAccountId
}) {
  const { user, video, text, inReplyToComment } = options

  let originCommentId: number | null = null
  let inReplyToCommentId: number | null = null

  if (inReplyToComment && inReplyToComment !== null) {
    originCommentId = inReplyToComment.originCommentId || inReplyToComment.id
    inReplyToCommentId = inReplyToComment.id
  }

  return sequelizeTypescript.transaction(async transaction => {
    const account = await AccountModel.load(user.Account.id, transaction)

    const automaticTags = await new AutomaticTagger().buildCommentsAutomaticTags({
      ownerAccount: video.VideoChannel.Account,
      text,
      transaction
    })

    const heldForReview = await shouldCommentBeHeldForReview({ user, video, automaticTags, transaction })

    const comment = await VideoCommentModel.create({
      text,
      originCommentId,
      inReplyToCommentId,
      videoId: video.id,
      accountId: account.id,
      heldForReview,
      url: new Date().toISOString()
    }, { transaction, validate: false })

    comment.url = getLocalVideoCommentActivityPubUrl(video, comment)

    const savedComment: MCommentOwnerVideoReply = await comment.save({ transaction })

    await setAndSaveCommentAutomaticTags({ comment: savedComment, automaticTags, transaction })

    savedComment.InReplyToVideoComment = inReplyToComment
    savedComment.Video = video
    savedComment.Account = account

    await sendCreateVideoCommentIfNeeded(savedComment, transaction)

    return savedComment
  })
}

export function buildFormattedCommentTree (resultList: ResultList<MCommentFormattable>): VideoCommentThreadTree {
  // Comments are sorted by id ASC
  const comments = resultList.data

  const comment = comments.shift()
  const thread: VideoCommentThreadTree = {
    comment: comment.toFormattedJSON(),
    children: []
  }
  const idx = {
    [comment.id]: thread
  }

  while (comments.length !== 0) {
    const childComment = comments.shift()

    const childCommentThread: VideoCommentThreadTree = {
      comment: childComment.toFormattedJSON(),
      children: []
    }

    const parentCommentThread = idx[childComment.inReplyToCommentId]
    // Maybe the parent comment was blocked by the admin/user
    if (!parentCommentThread) continue

    parentCommentThread.children.push(childCommentThread)
    idx[childComment.id] = childCommentThread
  }

  return thread
}

export async function shouldCommentBeHeldForReview (options: {
  user: MUserAccountId
  video: MVideoAccountLight
  automaticTags: { name: string, accountId: number }[]
  transaction?: Transaction
}) {
  const { user, video, transaction, automaticTags } = options

  if (video.isOwned() && user) {
    if (user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)) return false
    if (user.Account.id === video.VideoChannel.accountId) return false
  }

  if (video.commentsPolicy === VideoCommentPolicy.REQUIRES_APPROVAL) return true
  if (video.isOwned() !== true) return false

  const ownerAccountTags = automaticTags
    .filter(t => t.accountId === video.VideoChannel.accountId)
    .map(t => t.name)

  if (ownerAccountTags.length === 0) return false

  return AccountAutomaticTagPolicyModel.hasPolicyOnTags({
    accountId: video.VideoChannel.accountId,
    policy: AutomaticTagPolicy.REVIEW_COMMENT,
    tags: ownerAccountTags,
    transaction
  })
}
