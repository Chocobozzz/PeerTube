import { VideoCommentThreadTree as VideoCommentThreadTreeServerModel } from '@peertube/peertube-models'
import { VideoComment } from './video-comment.model'

export class VideoCommentThreadTree implements VideoCommentThreadTreeServerModel {
  comment: VideoComment
  hasDisplayedChildren: boolean

  // The server truncates the tree in depth and in width, so `children` may contain less elements than `totalChildren`
  children: VideoCommentThreadTree[]
  totalChildren: number

  // Number of children actually fetched from the server (unlike `children.length`, doesn't count replies inserted locally)
  fetchedChildren: number
}
