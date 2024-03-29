import { ResultList } from '../../common/index.js'
import { Account } from '../../actors/index.js'

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

  heldForReview: boolean
}

export interface VideoCommentForAdminOrUser {
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

  heldForReview: boolean

  automaticTags: string[]
}

export type VideoCommentThreads = ResultList<VideoComment> & { totalNotDeletedComments: number }

export interface VideoCommentThreadTree {
  comment: VideoComment
  children: VideoCommentThreadTree[]
}
