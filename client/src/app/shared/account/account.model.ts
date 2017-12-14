import { Account as ServerAccount } from '../../../../../shared/models/actors/account.model'
import { Avatar } from '../../../../../shared/models/avatars/avatar.model'
import { environment } from '../../../environments/environment'

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

    return '/client/assets/images/default-avatar.png'
  }
}
