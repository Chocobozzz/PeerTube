import { Actor } from './actor.model.js'

export type FollowState = 'pending' | 'accepted' | 'rejected'

export interface ActorFollow {
  id: number
  follower: Actor & { hostRedundancyAllowed: boolean }
  following: Actor & { hostRedundancyAllowed: boolean }
  score: number
  state: FollowState
  createdAt: Date
  updatedAt: Date
}
