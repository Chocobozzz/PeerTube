import { Account } from '../actors'

export interface VideoComment {
  id: number
  url: string
  text: string
  threadId: number
  inReplyToCommentId: number
  videoId: number
  createdAt: Date | string
  updatedAt: Date | string
  deletedAt: Date | string
  isDeleted: boolean
  totalRepliesFromVideoAuthor: number
  totalReplies: number
  account: Account
}

export interface VideoCommentAdmin {
  id: number
  url: string
  text: string

  threadId: number
  inReplyToCommentId: number

  createdAt: Date | string
  updatedAt: Date | string

  account: Account

  video: {
    id: number
    uuid: string
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
