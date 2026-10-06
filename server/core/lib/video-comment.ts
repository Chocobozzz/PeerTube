import { AutomaticTagPolicy, UserRight, VideoCommentPolicy, VideoCommentThreadTree } from '@peertube/peertube-models'
import { afterCommitIfTransaction, runInReadCommittedTransaction } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
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
  MCommentOwnerVideoReply,
  MUserAccountId,
  MVideoAccountIdUrl,
  MVideoAccountLight
} from '../types/models/index.js'
import { sendCreateVideoCommentIfNeeded, sendDeleteVideoComment, sendReplyApproval } from './activitypub/send/index.js'
import { getLocalVideoCommentActivityPubUrl } from './activitypub/url.js'
import { createCommentAutomaticTagsJob } from './automatic-tags/automatic-tags.js'
import { Notifier } from './notifier/notifier.js'
import { Hooks } from './plugins/hooks.js'

const logger = createLogger()

export async function removeComment (commentArg: MComment, req: express.Request, res: express.Response) {
  let videoCommentInstanceBefore: MCommentOwnerVideo

  await sequelizeTypescript.transaction(async t => {
    const comment = await VideoCommentModel.loadByUrlAndPopulateAccountAndVideoAndReply(commentArg.url, t)

    videoCommentInstanceBefore = cloneDeep(comment)

    if (comment.isLocal() || comment.Video.isLocal()) {
      await sendDeleteVideoComment(comment, t)
    }

    comment.markAsDeleted()

    await comment.save({ transaction: t })

    logger.info('Video comment %d deleted.', comment.id)
  })

  Hooks.runAction('action:api.video-comment.deleted', { comment: videoCommentInstanceBefore, req, res })
}

export async function approveComment (commentArg: MComment, options: { notify?: boolean, transaction?: Transaction } = {}) {
  const { notify = true, transaction } = options

  const run = async (t: Transaction) => {
    const comment = await VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(commentArg.id, t)

    const oldHeldForReview = comment.heldForReview

    comment.heldForReview = false
    await comment.save({ transaction: t })

    if (comment.isLocal()) {
      await sendCreateVideoCommentIfNeeded(comment, t)
    } else {
      afterCommitIfTransaction(t, () => sendReplyApproval(comment, 'ApproveReply'))
    }

    if (notify && oldHeldForReview !== comment.heldForReview) {
      afterCommitIfTransaction(t, () => Notifier.Instance.notifyOnNewCommentApproval(comment))
    }

    logger.info('Video comment %d approved.', comment.id)
  }

  if (transaction) await run(transaction)
  else await sequelizeTypescript.transaction(run)
}

export async function createLocalVideoComment (options: {
  text: string
  inReplyToComment: MComment | null
  video: MVideoAccountLight
  user: MUserAccountId
}) {
  const { user, video, text, inReplyToComment } = options

  let originCommentId: number | null = null
  let inReplyToCommentId: number | null = null

  if (inReplyToComment && inReplyToComment !== null) {
    originCommentId = inReplyToComment.originCommentId || inReplyToComment.id
    inReplyToCommentId = inReplyToComment.id
  }

  return runInReadCommittedTransaction(async transaction => {
    const account = await AccountModel.load(user.Account.id, transaction)

    const holdStatus = await getCommentHoldStatus({
      user,
      video,
      holdIfAutoTagPolicy: true,
      transaction
    })

    const comment = await VideoCommentModel.create({
      text,
      originCommentId,
      inReplyToCommentId,
      videoId: video.id,
      accountId: account.id,
      heldForReview: holdStatus !== 'not-held',
      url: new Date().toISOString()
    }, { transaction, validate: false })

    comment.url = getLocalVideoCommentActivityPubUrl(video, comment)

    const savedComment: MCommentOwnerVideoReply = await comment.save({ transaction })

    createCommentAutomaticTagsJob({
      comment: savedComment,
      moderation: holdStatus === 'held-for-auto-tags'
        ? 'release-hold'
        : 'none',
      notify: true,
      transaction
    })

    savedComment.InReplyToVideoComment = inReplyToComment
    savedComment.Video = video
    savedComment.Account = account

    await sendCreateVideoCommentIfNeeded(savedComment, transaction)

    return { comment: savedComment, holdStatus }
  })
}

// `replies` is a flat and truncated view of the descendants of `parentCommentId
export function buildFormattedCommentTrees (options: {
  parentCommentId: number
  replies: MCommentFormattable[]
}): VideoCommentThreadTree[] {
  const { parentCommentId, replies } = options

  const roots: VideoCommentThreadTree[] = []
  const idx: { [id: number]: VideoCommentThreadTree } = {}

  for (const reply of replies) {
    const formattedComment = reply.toFormattedJSON()

    idx[reply.id] = {
      comment: formattedComment,
      children: [],

      totalChildren: formattedComment.totalReplies
    }
  }

  // The flat list is not sorted by depth, so we can only attach children once every node exists
  for (const reply of replies) {
    if (reply.inReplyToCommentId === parentCommentId) {
      roots.push(idx[reply.id])
      continue
    }

    // Maybe the parent comment was blocked by the admin/user, or truncated from the tree
    const parentNode = idx[reply.inReplyToCommentId]
    if (!parentNode) continue

    parentNode.children.push(idx[reply.id])
  }

  return roots
}

export function buildFormattedCommentTree (options: {
  comment: MCommentFormattable
  totalChildren: number
  replies: MCommentFormattable[]
}): VideoCommentThreadTree {
  const { comment, totalChildren, replies } = options

  return {
    comment: comment.toFormattedJSON(),
    children: buildFormattedCommentTrees({ parentCommentId: comment.id, replies }),
    totalChildren
  }
}

export type CommentHoldStatus = 'held-for-review' | 'held-for-auto-tags' | 'not-held'

export async function getCommentHoldStatus (options: {
  user: MUserAccountId
  video: MVideoAccountIdUrl

  // The automatic tags of the comment have not been built yet: we don't know which tags it will have
  holdIfAutoTagPolicy: boolean
  ownerAutomaticTags?: string[]

  transaction?: Transaction
}): Promise<CommentHoldStatus> {
  const { user, video, transaction, holdIfAutoTagPolicy, ownerAutomaticTags } = options

  // User bypass check
  if (video.isLocal() && user) {
    if (user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)) return 'not-held'
    if (user.Account.id === video.VideoChannel.accountId) return 'not-held'
  }

  // Global owner policy
  if (video.commentsPolicy === VideoCommentPolicy.REQUIRES_APPROVAL) {
    return 'held-for-review'
  }

  // Don't check auto tags policy on remote videos
  if (video.isLocal() !== true) return 'not-held'

  // Hold the comment if the account could want to review it
  // Let the `build-object-automatic-tags` job release it if the tags it ends up with don't match any of its review policies
  if (holdIfAutoTagPolicy) {
    const hasPolicy = await AccountAutomaticTagPolicyModel.hasPolicy({
      accountId: video.VideoChannel.accountId,
      policy: AutomaticTagPolicy.REVIEW_COMMENT,
      transaction
    })

    return hasPolicy
      ? 'held-for-auto-tags'
      : 'not-held'
  }

  if (!ownerAutomaticTags || ownerAutomaticTags.length === 0) return 'not-held'

  // Check on specific auto tags provided
  const hasPolicy = await AccountAutomaticTagPolicyModel.hasPolicyOnTags({
    accountId: video.VideoChannel.accountId,
    policy: AutomaticTagPolicy.REVIEW_COMMENT,
    tags: ownerAutomaticTags,
    transaction
  })

  return hasPolicy
    ? 'held-for-review'
    : 'not-held'
}
