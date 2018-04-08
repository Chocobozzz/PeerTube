import * as Sequelize from 'sequelize'
import { ResultList } from '../../shared/models'
import { VideoCommentThreadTree } from '../../shared/models/videos/video-comment.model'
import { AccountModel } from '../models/account/account'
import { VideoModel } from '../models/video/video'
import { VideoCommentModel } from '../models/video/video-comment'
import { getVideoCommentActivityPubUrl } from './activitypub'
import { sendCreateVideoComment } from './activitypub/send'

async function createVideoComment (obj: {
  text: string,
  inReplyToComment: VideoCommentModel,
  video: VideoModel
  account: AccountModel
}, t: Sequelize.Transaction) {
  let originCommentId: number = null
  let inReplyToCommentId: number = null

  if (obj.inReplyToComment) {
    originCommentId = obj.inReplyToComment.originCommentId || obj.inReplyToComment.id
    inReplyToCommentId = obj.inReplyToComment.id
  }

  const comment = await VideoCommentModel.create({
    text: obj.text,
    originCommentId,
    inReplyToCommentId,
    videoId: obj.video.id,
    accountId: obj.account.id,
    url: 'fake url'
  }, { transaction: t, validate: false })

  comment.set('url', getVideoCommentActivityPubUrl(obj.video, comment))

  const savedComment = await comment.save({ transaction: t })
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
    if (!parentCommentThread) {
      const msg = `Cannot format video thread tree, parent ${childComment.inReplyToCommentId} not found for child ${childComment.id}`
      throw new Error(msg)
    }

    parentCommentThread.children.push(childCommentThread)
    idx[childComment.id] = childCommentThread
  }

  return thread
}

// ---------------------------------------------------------------------------

export {
  createVideoComment,
  buildFormattedCommentTree
}
