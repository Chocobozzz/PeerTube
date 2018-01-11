import { Actor } from './actor.model'

export type FollowState = 'pending' | 'accepted'

export interface AccountFollow {
  id: number
  follower: Actor
  following: Actor
  score: number
  state: FollowState
  createdAt: Date
  updatedAt: Date
}
