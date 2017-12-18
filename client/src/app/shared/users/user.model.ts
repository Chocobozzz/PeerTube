import { hasUserRight, User as UserServerModel, UserRight, UserRole, VideoChannel } from '../../../../../shared'
import { Account } from '../account/account.model'

export type UserConstructorHash = {
  id: number,
  username: string,
  email: string,
  role: UserRole,
  videoQuota?: number,
  displayNSFW?: boolean,
  autoPlayVideo?: boolean,
  createdAt?: Date,
  account?: Account,
  videoChannels?: VideoChannel[]
}
export class User implements UserServerModel {
  id: number
  username: string
  email: string
  role: UserRole
  displayNSFW: boolean
  autoPlayVideo: boolean
  videoQuota: number
  account: Account
  videoChannels: VideoChannel[]
  createdAt: Date

  constructor (hash: UserConstructorHash) {
    this.id = hash.id
    this.username = hash.username
    this.email = hash.email
    this.role = hash.role
    this.account = hash.account

    if (hash.videoChannels !== undefined) {
      this.videoChannels = hash.videoChannels
    }

    if (hash.videoQuota !== undefined) {
      this.videoQuota = hash.videoQuota
    }

    if (hash.displayNSFW !== undefined) {
      this.displayNSFW = hash.displayNSFW
    }

    if (hash.autoPlayVideo !== undefined) {
      this.autoPlayVideo = hash.autoPlayVideo
    }

    if (hash.createdAt !== undefined) {
      this.createdAt = hash.createdAt
    }
  }

  hasRight (right: UserRight) {
    return hasUserRight(this.role, right)
  }

  getAvatarPath () {
    return Account.GET_ACCOUNT_AVATAR_PATH(this.account)
  }
}
