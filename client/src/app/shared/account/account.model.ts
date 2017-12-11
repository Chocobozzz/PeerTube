import { Account as ServerAccount } from '../../../../../shared/models/accounts/account.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'

export class Account implements ServerAccount {
  id: number
  uuid: string
  name: string
  host: string
  followingCount: number
  followersCount: number
  createdAt: Date
  updatedAt: Date
  avatar: Avatar

  static GET_ACCOUNT_AVATAR_PATH (account: Account) {
    if (account && account.avatar) return account.avatar.path

    return API_URL + '/client/assets/images/default-avatar.png'
  }
}
