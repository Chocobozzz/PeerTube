import { Account } from '../actors'

export interface VideoChangeOwnership {
  id: number
  initiatorAccount: Account
  nextOwnerAccount: Account
  video: {
    id: number
    name: string
    uuid: string
    url: string
  }
  createdAt: Date
}
