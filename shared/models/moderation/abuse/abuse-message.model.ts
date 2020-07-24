import { AccountSummary } from '@shared/models'

export interface AbuseMessage {
  id: number
  message: string
  byModerator: boolean
  createdAt: Date | string

  account: AccountSummary
}
