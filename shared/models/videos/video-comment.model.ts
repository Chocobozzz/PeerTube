export interface VideoComment {
  id: number
  url: string
  text: string
  threadId: number
  inReplyToCommentId: number
  videoId: number
  createdAt: Date | string
  updatedAt: Date | string
  account: {
    name: string
  }
}

export interface VideoCommentThreadTree {
  comment: VideoComment
  children: VideoCommentThreadTree[]
}

export interface VideoCommentCreate {
  text: string
}
