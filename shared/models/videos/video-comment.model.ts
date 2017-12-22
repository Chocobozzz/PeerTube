export interface VideoComment {
  id: number
  url: string
  text: string
  threadId: number
  inReplyToCommentId: number
  videoId: number
  createdAt: Date | string
  updatedAt: Date | string
}

export interface VideoCommentThread {
  comment: VideoComment
  children: VideoCommentThread[]
}

export interface VideoCommentCreate {
  text: string
}
