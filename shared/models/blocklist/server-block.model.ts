import { Account } from '../actors'

export interface ServerBlock {
  byAccount: Account
  serverBlocked: {
    host: string
  }
  createdAt: Date | string
}
