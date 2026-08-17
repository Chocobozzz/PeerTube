import { AutomaticTagPolicy, UserRight, VideoCommentPolicy, VideoCommentThreadTree } from '@peertube/peertube-models'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import { AccountModel } from '@server/models/account/account.js'
import { getServerAccount } from '@server/models/application/application.js'
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
  MVideoAccountLight
} from '../types/models/index.js'
import { sendCreateVideoCommentIfNeeded, sendDeleteVideoComment, sendReplyApproval } from './activitypub/send/index.js'
import { getLocalVideoCommentActivityPubUrl } from './activitypub/url.js'
import { AutomaticTagger } from './automatic-tags/automatic-tagger.js'
import { setAndSaveCommentAutomaticTags } from './automatic-tags/automatic-tags.js'
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

export async function approveComment (commentArg: MComment) {
  await sequelizeTypescript.transaction(async t => {
    const comment = await VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(commentArg.id, t)

    const oldHeldForReview = comment.heldForReview

    comment.heldForReview = false
    await comment.save({ transaction: t })

    if (comment.isLocal()) {
      await sendCreateVideoCommentIfNeeded(comment, t)
    } else {
      afterCommitIfTransaction(t, () => sendReplyApproval(comment, 'ApproveReply'))
    }

    if (oldHeldForReview !== comment.heldForReview) {
      afterCommitIfTransaction(t, () => Notifier.Instance.notifyOnNewCommentApproval(comment))
    }

    logger.info('Video comment %d approved.', comment.id)
  })
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

  return sequelizeTypescript.transaction(async transaction => {
    const account = await AccountModel.load(user.Account.id, transaction)

    const automaticTagsByAccount = await new AutomaticTagger().buildCommentsAutomaticTags({
      serverAccount: await getServerAccount(),
      ownerAccount: video.VideoChannel.Account,
      text,
      transaction
    })

    const heldForReview = await shouldCommentBeHeldForReview({
      user,
      video,
      ownerAutomaticTags: automaticTagsByAccount[video.VideoChannel.accountId],
      transaction
    })

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

    await setAndSaveCommentAutomaticTags({ comment: savedComment, automaticTagsByAccount, transaction })

    savedComment.InReplyToVideoComment = inReplyToComment
    savedComment.Video = video
    savedComment.Account = account

    await sendCreateVideoCommentIfNeeded(savedComment, transaction)

    return savedComment
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

export async function shouldCommentBeHeldForReview (options: {
  user: MUserAccountId
  video: MVideoAccountLight
  ownerAutomaticTags: string[]
  transaction?: Transaction
}) {
  const { user, video, transaction, ownerAutomaticTags } = options

  if (video.isLocal() && user) {
    if (user.hasRight(UserRight.MANAGE_ANY_VIDEO_COMMENT)) return false
    if (user.Account.id === video.VideoChannel.accountId) return false
  }

  if (video.commentsPolicy === VideoCommentPolicy.REQUIRES_APPROVAL) return true
  if (video.isLocal() !== true) return false

  if (!ownerAutomaticTags || ownerAutomaticTags.length === 0) return false

  return AccountAutomaticTagPolicyModel.hasPolicyOnTags({
    accountId: video.VideoChannel.accountId,
    policy: AutomaticTagPolicy.REVIEW_COMMENT,
    tags: ownerAutomaticTags,
    transaction
  })
}
