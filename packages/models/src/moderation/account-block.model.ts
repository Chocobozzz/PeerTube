import { Account } from '../actors/index.js'

export interface AccountBlock {
  byAccount: Account
  blockedAccount: Account
  createdAt: Date | string
}
