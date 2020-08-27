import { AccountSummary } from '../../actors/account.model'

export interface AbuseMessage {
  id: number
  message: string
  byModerator: boolean
  createdAt: Date | string

  account: AccountSummary
}
