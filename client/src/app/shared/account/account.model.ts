import { Account as ServerAccount } from '../../../../../shared/models/actors/account.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { getAbsoluteAPIUrl } from '../misc/utils'

export class Account implements ServerAccount {
  id: number
  uuid: string
  url: string
  name: string
  displayName: string
  description: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date
  updatedAt: Date
  avatar: Avatar

  constructor (hash: ServerAccount) {
    this.id = hash.id
    this.uuid = hash.uuid
    this.url = hash.url
    this.name = hash.name
    this.displayName = hash.displayName
    this.description = hash.description
    this.host = hash.host
    this.followingCount = hash.followingCount
    this.followersCount = hash.followersCount
    this.createdAt = new Date(hash.createdAt.toString())
    this.updatedAt = new Date(hash.updatedAt.toString())
    this.avatar = hash.avatar
  }

  static GET_ACCOUNT_AVATAR_URL (account: Account) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()

    if (account && account.avatar) return absoluteAPIUrl + account.avatar.path

    return window.location.origin + '/client/assets/images/default-avatar.png'
  }

  static CREATE_BY_STRING (accountName: string, host: string) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()
    const thisHost = new URL(absoluteAPIUrl).host

    if (host.trim() === thisHost) return accountName

    return accountName + '@' + host
  }
}
