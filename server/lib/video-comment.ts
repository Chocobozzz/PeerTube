import * as Sequelize from 'sequelize'
import { ResultList } from '../../shared/models'
import { VideoCommentThread } from '../../shared/models/videos/video-comment.model'
import { VideoModel } from '../models/video/video'
import { VideoCommentModel } from '../models/video/video-comment'
import { getVideoCommentActivityPubUrl } from './activitypub'

async function createVideoComment (obj: {
  text: string,
  inReplyToComment: number,
  video: VideoModel
  actorId: number
}, t: Sequelize.Transaction) {
  let originCommentId: number = null
  if (obj.inReplyToComment) {
    const repliedComment = await VideoCommentModel.loadById(obj.inReplyToComment)
    if (!repliedComment) throw new Error('Unknown replied comment.')

    originCommentId = repliedComment.originCommentId || repliedComment.id
  }

  const comment = await VideoCommentModel.create({
    text: obj.text,
    originCommentId,
    inReplyToComment: obj.inReplyToComment,
    videoId: obj.video.id,
    actorId: obj.actorId
  }, { transaction: t })

  comment.set('url', getVideoCommentActivityPubUrl(obj.video, comment))

  return comment.save({ transaction: t })
}

function buildFormattedCommentTree (resultList: ResultList<VideoCommentModel>): VideoCommentThread {
  // Comments are sorted by id ASC
  const comments = resultList.data

  const comment = comments.shift()
  const thread: VideoCommentThread = {
    comment: comment.toFormattedJSON(),
    children: []
  }
  const idx = {
    [comment.id]: thread
  }

  while (comments.length !== 0) {
    const childComment = comments.shift()

    const childCommentThread: VideoCommentThread = {
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
