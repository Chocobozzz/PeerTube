import { VideoModel } from '../models/video/video'
import { VideoCommentModel } from '../models/video/video-comment'
import { VideoCommentCreate } from '../../shared/models/videos/video-comment.model'
import { VideoCreate, VideoImportCreate } from '../../shared/models/videos'
import { UserModel } from '../models/account/user'
import { VideoTorrentObject } from '../../shared/models/activitypub/objects'
import { ActivityCreate } from '../../shared/models/activitypub'
import { ActorModel } from '../models/activitypub/actor'
import { VideoCommentObject } from '../../shared/models/activitypub/objects/video-comment-object'
import { VideoFileModel } from '@server/models/video/video-file'
import { PathLike } from 'fs-extra'
import { MUser } from '@server/typings/models'

export type AcceptResult = {
  accepted: boolean
  errorMessage?: string
}

// Can be filtered by plugins
function isLocalVideoAccepted (object: {
  videoBody: VideoCreate
  videoFile: Express.Multer.File & { duration?: number }
  user: UserModel
}): AcceptResult {
  return { accepted: true }
}

function isLocalVideoThreadAccepted (_object: {
  commentBody: VideoCommentCreate
  video: VideoModel
  user: UserModel
}): AcceptResult {
  return { accepted: true }
}

function isLocalVideoCommentReplyAccepted (_object: {
  commentBody: VideoCommentCreate
  parentComment: VideoCommentModel
  video: VideoModel
  user: UserModel
}): AcceptResult {
  return { accepted: true }
}

function isRemoteVideoAccepted (_object: {
  activity: ActivityCreate
  videoAP: VideoTorrentObject
  byActor: ActorModel
}): AcceptResult {
  return { accepted: true }
}

function isRemoteVideoCommentAccepted (_object: {
  activity: ActivityCreate
  commentAP: VideoCommentObject
  byActor: ActorModel
}): AcceptResult {
  return { accepted: true }
}

function isPreImportVideoAccepted (object: {
  videoImportBody: VideoImportCreate
  user: MUser
}): AcceptResult {
  return { accepted: true }
}

function isPostImportVideoAccepted (object: {
  videoFilePath: PathLike
  videoFile: VideoFileModel
  user: MUser
}): AcceptResult {
  return { accepted: true }
}

export {
  isLocalVideoAccepted,
  isLocalVideoThreadAccepted,
  isRemoteVideoAccepted,
  isRemoteVideoCommentAccepted,
  isLocalVideoCommentReplyAccepted,
  isPreImportVideoAccepted,
  isPostImportVideoAccepted
}
