import { Account } from '../actors'

export interface AccountBlock {
  byAccount: Account
  blockedAccount: Account
  createdAt: Date | string
}
