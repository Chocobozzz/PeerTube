import {
  User as UserServerModel,
  UserRole,
  VideoChannel,
  UserRight,
  hasUserRight
} from '../../../../../shared'

export type UserConstructorHash = {
  id: number,
  username: string,
  email: string,
  role: UserRole,
  videoQuota?: number,
  displayNSFW?: boolean,
  createdAt?: Date,
  account?: {
    id: number
    uuid: string
  },
  videoChannels?: VideoChannel[]
}
export class User implements UserServerModel {
  id: number
  username: string
  email: string
  role: UserRole
  displayNSFW: boolean
  videoQuota: number
  account: {
    id: number
    uuid: string
  }
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

    if (hash.createdAt !== undefined) {
      this.createdAt = hash.createdAt
    }
  }

  hasRight (right: UserRight) {
    return hasUserRight(this.role, right)
  }
}
