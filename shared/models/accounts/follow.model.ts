import { Account } from './account.model'

export type FollowState = 'pending' | 'accepted'

export interface AccountFollow {
  id: number
  follower: Account
  following: Account
  state: FollowState
  createdAt: Date
  updatedAt: Date
}
