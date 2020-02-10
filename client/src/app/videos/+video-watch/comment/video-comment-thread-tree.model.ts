import { VideoCommentThreadTree as VideoCommentThreadTreeServerModel } from '../../../../../../shared/models/videos/video-comment.model'
import { VideoComment } from '@app/videos/+video-watch/comment/video-comment.model'

export class VideoCommentThreadTree implements VideoCommentThreadTreeServerModel {
  comment: VideoComment
  children: VideoCommentThreadTree[]
}
