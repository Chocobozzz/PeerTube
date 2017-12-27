import { VideoComment as VideoCommentServerModel } from '../../../../../../shared/models/videos/video-comment.model'

export class VideoComment implements VideoCommentServerModel {
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
    host: string
  }
  totalReplies: number

  by: string

  private static createByString (account: string, serverHost: string) {
    return account + '@' + serverHost
  }

  constructor (hash: VideoCommentServerModel) {
    this.id = hash.id
    this.url = hash.url
    this.text = hash.text
    this.threadId = hash.threadId
    this.inReplyToCommentId = hash.inReplyToCommentId
    this.videoId = hash.videoId
    this.createdAt = new Date(hash.createdAt.toString())
    this.updatedAt = new Date(hash.updatedAt.toString())
    this.account = hash.account
    this.totalReplies = hash.totalReplies

    this.by = VideoComment.createByString(this.account.name, this.account.host)
  }
}
