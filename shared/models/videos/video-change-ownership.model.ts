import { Account } from '../actors'

export interface VideoChangeOwnership {
  id: number
  status: VideoChangeOwnershipStatus
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

export enum VideoChangeOwnershipStatus {
  WAITING = 'WAITING',
  ACCEPTED = 'ACCEPTED',
  REFUSED = 'REFUSED'
}
