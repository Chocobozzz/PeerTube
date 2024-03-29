import { getAbsoluteAPIUrl } from '@app/helpers'
import {
  Account as AccountInterface,
  VideoComment as VideoCommentServerModel,
  VideoCommentForAdminOrUser as VideoCommentForAdminOrUserServerModel
} from '@peertube/peertube-models'
import { Actor } from '../shared-main/account/actor.model'
import { Video } from '../shared-main/video/video.model'

export class VideoComment implements VideoCommentServerModel {
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
  heldForReview: boolean
  account: AccountInterface
  totalRepliesFromVideoAuthor: number
  totalReplies: number
  by: string

  isLocal: boolean

  constructor (hash: VideoCommentServerModel) {
    this.id = hash.id
    this.url = hash.url
    this.text = hash.text
    this.threadId = hash.threadId
    this.inReplyToCommentId = hash.inReplyToCommentId
    this.videoId = hash.videoId
    this.createdAt = new Date(hash.createdAt.toString())
    this.updatedAt = new Date(hash.updatedAt.toString())
    this.deletedAt = hash.deletedAt ? new Date(hash.deletedAt.toString()) : null
    this.isDeleted = hash.isDeleted
    this.heldForReview = hash.heldForReview
    this.account = hash.account
    this.totalRepliesFromVideoAuthor = hash.totalRepliesFromVideoAuthor
    this.totalReplies = hash.totalReplies

    if (this.account) {
      this.by = Actor.CREATE_BY_STRING(this.account.name, this.account.host)

      const absoluteAPIUrl = getAbsoluteAPIUrl()
      const thisHost = new URL(absoluteAPIUrl).host
      this.isLocal = this.account.host.trim() === thisHost
    }
  }
}

export class VideoCommentForAdminOrUser implements VideoCommentForAdminOrUserServerModel {
  id: number
  url: string
  text: string
  textHtml: string

  threadId: number
  inReplyToCommentId: number

  createdAt: Date | string
  updatedAt: Date | string

  account: AccountInterface & { localUrl?: string }
  localUrl: string

  video: {
    id: number
    uuid: string
    name: string
    localUrl: string
  }

  heldForReview: boolean

  automaticTags: string[]

  by: string

  constructor (hash: VideoCommentForAdminOrUserServerModel, textHtml: string) {
    this.id = hash.id
    this.url = hash.url
    this.text = hash.text
    this.textHtml = textHtml

    this.heldForReview = hash.heldForReview

    this.threadId = hash.threadId
    this.inReplyToCommentId = hash.inReplyToCommentId

    this.createdAt = new Date(hash.createdAt.toString())
    this.updatedAt = new Date(hash.updatedAt.toString())

    this.automaticTags = hash.automaticTags

    this.video = {
      id: hash.video.id,
      uuid: hash.video.uuid,
      name: hash.video.name,
      localUrl: Video.buildWatchUrl(hash.video)
    }

    this.localUrl = this.video.localUrl + ';threadId=' + this.threadId

    this.account = hash.account

    if (this.account) {
      this.by = Actor.CREATE_BY_STRING(this.account.name, this.account.host)

      this.account.localUrl = '/a/' + this.by
    }
  }
}
