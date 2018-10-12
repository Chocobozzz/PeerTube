import { Account } from '../actors'

export interface ServerBlock {
  byAccount: Account
  blockedServer: {
    host: string
  }
  createdAt: Date | string
}
