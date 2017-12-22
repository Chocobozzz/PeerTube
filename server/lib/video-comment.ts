import * as Sequelize from 'sequelize'
import { ResultList } from '../../shared/models'
import { VideoCommentThreadTree } from '../../shared/models/videos/video-comment.model'
import { VideoModel } from '../models/video/video'
import { VideoCommentModel } from '../models/video/video-comment'
import { getVideoCommentActivityPubUrl } from './activitypub'

async function createVideoComment (obj: {
  text: string,
  inReplyToCommentId: number,
  video: VideoModel
  accountId: number
}, t: Sequelize.Transaction) {
  let originCommentId: number = null

  if (obj.inReplyToCommentId) {
    const repliedComment = await VideoCommentModel.loadById(obj.inReplyToCommentId)
    if (!repliedComment) throw new Error('Unknown replied comment.')

    originCommentId = repliedComment.originCommentId || repliedComment.id
  }

  const comment = await VideoCommentModel.create({
    text: obj.text,
    originCommentId,
    inReplyToCommentId: obj.inReplyToCommentId,
    videoId: obj.video.id,
    accountId: obj.accountId,
    url: 'fake url'
  }, { transaction: t, validate: false })

  comment.set('url', getVideoCommentActivityPubUrl(obj.video, comment))

  return comment.save({ transaction: t })
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
