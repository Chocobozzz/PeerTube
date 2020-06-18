import { cloneDeep } from 'lodash'
import * as Sequelize from 'sequelize'
import { logger } from '@server/helpers/logger'
import { sequelizeTypescript } from '@server/initializers/database'
import { ResultList } from '../../shared/models'
import { VideoCommentThreadTree } from '../../shared/models/videos/video-comment.model'
import { VideoCommentModel } from '../models/video/video-comment'
import { MAccountDefault, MComment, MCommentOwnerVideoReply, MVideoFullLight, MCommentOwnerVideo } from '../types/models'
import { sendCreateVideoComment, sendDeleteVideoComment } from './activitypub/send'
import { getVideoCommentActivityPubUrl } from './activitypub/url'
import { Hooks } from './plugins/hooks'

async function removeComment (videoCommentInstance: MCommentOwnerVideo) {
  const videoCommentInstanceBefore = cloneDeep(videoCommentInstance)

  await sequelizeTypescript.transaction(async t => {
    if (videoCommentInstance.isOwned() || videoCommentInstance.Video.isOwned()) {
      await sendDeleteVideoComment(videoCommentInstance, t)
    }

    markCommentAsDeleted(videoCommentInstance)

    await videoCommentInstance.save()
  })

  logger.info('Video comment %d deleted.', videoCommentInstance.id)

  Hooks.runAction('action:api.video-comment.deleted', { comment: videoCommentInstanceBefore })
}

async function createVideoComment (obj: {
  text: string
  inReplyToComment: MComment | null
  video: MVideoFullLight
  account: MAccountDefault
}, t: Sequelize.Transaction) {
  let originCommentId: number | null = null
  let inReplyToCommentId: number | null = null

  if (obj.inReplyToComment && obj.inReplyToComment !== null) {
    originCommentId = obj.inReplyToComment.originCommentId || obj.inReplyToComment.id
    inReplyToCommentId = obj.inReplyToComment.id
  }

  const comment = await VideoCommentModel.create({
    text: obj.text,
    originCommentId,
    inReplyToCommentId,
    videoId: obj.video.id,
    accountId: obj.account.id,
    url: new Date().toISOString()
  }, { transaction: t, validate: false })

  comment.url = getVideoCommentActivityPubUrl(obj.video, comment)

  const savedComment: MCommentOwnerVideoReply = await comment.save({ transaction: t })
  savedComment.InReplyToVideoComment = obj.inReplyToComment
  savedComment.Video = obj.video
  savedComment.Account = obj.account

  await sendCreateVideoComment(savedComment, t)

  return savedComment
}

function buildFormattedCommentTree (resultList: ResultList<VideoCommentModel>): VideoCommentThreadTree {
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

function markCommentAsDeleted (comment: MComment): void {
  comment.text = ''
  comment.deletedAt = new Date()
  comment.accountId = null
}

// ---------------------------------------------------------------------------

export {
  removeComment,
  createVideoComment,
  buildFormattedCommentTree,
  markCommentAsDeleted
}
