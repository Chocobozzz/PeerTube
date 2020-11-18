import { getAbsoluteAPIUrl } from '@app/helpers'
import { Account, Actor } from '@app/shared/shared-main'
import { Account as AccountInterface, VideoComment as VideoCommentServerModel, VideoCommentAdmin as VideoCommentAdminServerModel } from '@shared/models'

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
  account: AccountInterface
  totalRepliesFromVideoAuthor: number
  totalReplies: number
  by: string
  accountAvatarUrl: string

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
    this.account = hash.account
    this.totalRepliesFromVideoAuthor = hash.totalRepliesFromVideoAuthor
    this.totalReplies = hash.totalReplies

    if (this.account) {
      this.by = Actor.CREATE_BY_STRING(this.account.name, this.account.host)
      this.accountAvatarUrl = Account.GET_ACTOR_AVATAR_URL(this.account)

      const absoluteAPIUrl = getAbsoluteAPIUrl()
      const thisHost = new URL(absoluteAPIUrl).host
      this.isLocal = this.account.host.trim() === thisHost
    }
  }
}

export class VideoCommentAdmin implements VideoCommentAdminServerModel {
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

  by: string
  accountAvatarUrl: string

  constructor (hash: VideoCommentAdminServerModel, textHtml: string) {
    this.id = hash.id
    this.url = hash.url
    this.text = hash.text
    this.textHtml = textHtml

    this.threadId = hash.threadId
    this.inReplyToCommentId = hash.inReplyToCommentId

    this.createdAt = new Date(hash.createdAt.toString())
    this.updatedAt = new Date(hash.updatedAt.toString())

    this.video = {
      id: hash.video.id,
      uuid: hash.video.uuid,
      name: hash.video.name,
      localUrl: '/videos/watch/' + hash.video.uuid
    }

    this.localUrl = this.video.localUrl + ';threadId=' + this.threadId

    this.account = hash.account

    if (this.account) {
      this.by = Actor.CREATE_BY_STRING(this.account.name, this.account.host)
      this.accountAvatarUrl = Account.GET_ACTOR_AVATAR_URL(this.account)

      this.account.localUrl = '/accounts/' + this.by
    }
  }
}
