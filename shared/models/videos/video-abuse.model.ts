import { Account } from '../actors'

export interface VideoAbuse {
  id: number
  reason: string
  reporterAccount: Account
  video: {
    id: number
    name: string
    uuid: string
    url: string
  }
  createdAt: Date
}
