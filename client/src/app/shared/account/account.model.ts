import { Account as ServerAccount } from '../../../../../shared/models/actors/account.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { environment } from '../../../environments/environment'
import { getAbsoluteAPIUrl } from '../misc/utils'

export class Account implements ServerAccount {
  id: number
  uuid: string
  name: string
  displayName: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date
  updatedAt: Date
  avatar: Avatar

  static GET_ACCOUNT_AVATAR_URL (account: Account) {
    const absoluteAPIUrl = getAbsoluteAPIUrl()

    if (account && account.avatar) return absoluteAPIUrl + account.avatar.path

    return window.location.origin + '/client/assets/images/default-avatar.png'
  }
}
