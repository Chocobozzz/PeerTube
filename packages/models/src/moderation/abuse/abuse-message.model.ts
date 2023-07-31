import { AccountSummary } from '../../actors/account.model.js'

export interface AbuseMessage {
  id: number
  message: string
  byModerator: boolean
  createdAt: Date | string

  account: AccountSummary
}
