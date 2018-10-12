import { Account } from '../actors'

export interface AccountBlock {
  byAccount: Account
  accountBlocked: Account
  createdAt: Date | string
}
