import { Account } from '../actors/index.js'

export interface ServerBlock {
  byAccount: Account

  blockedServer: {
    host: string
  }

  blocklistSubscription?: {
    id: number
    name: string
    url: string
  }

  createdAt: Date | string
}
