import express from 'express'
import { VideoCommentModel } from '@server/models/video/video-comment.js'
import { MVideoId } from '@server/types/models/index.js'
import { forceNumber } from '@peertube/peertube-core-utils'
import { HttpStatusCode, ServerErrorCode } from '@peertube/peertube-models'

async function doesVideoCommentThreadExist (idArg: number | string, video: MVideoId, res: express.Response) {
  const id = forceNumber(idArg)
  const videoComment = await VideoCommentModel.loadById(id)

  if (!videoComment) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video comment thread not found'
    })
    return false
  }

  if (videoComment.videoId !== video.id) {
    res.fail({
      type: ServerErrorCode.COMMENT_NOT_ASSOCIATED_TO_VIDEO,
      message: 'Video comment is not associated to this video.'
    })
    return false
  }

  if (videoComment.inReplyToCommentId !== null) {
    res.fail({ message: 'Video comment is not a thread.' })
    return false
  }

  res.locals.videoCommentThread = videoComment
  return true
}

async function doesVideoCommentExist (idArg: number | string, video: MVideoId, res: express.Response) {
  const id = forceNumber(idArg)
  const videoComment = await VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(id)

  if (!videoComment) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video comment thread not found'
    })
    return false
  }

  if (videoComment.videoId !== video.id) {
    res.fail({
      type: ServerErrorCode.COMMENT_NOT_ASSOCIATED_TO_VIDEO,
      message: 'Video comment is not associated to this video.'
    })
    return false
  }

  res.locals.videoCommentFull = videoComment
  return true
}

async function doesCommentIdExist (idArg: number | string, res: express.Response) {
  const id = forceNumber(idArg)
  const videoComment = await VideoCommentModel.loadByIdAndPopulateVideoAndAccountAndReply(id)

  if (!videoComment) {
    res.fail({
      status: HttpStatusCode.NOT_FOUND_404,
      message: 'Video comment thread not found'
    })
    return false
  }

  res.locals.videoCommentFull = videoComment
  return true
}

export {
  doesVideoCommentThreadExist,
  doesVideoCommentExist,
  doesCommentIdExist
}
