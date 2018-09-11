import { Actor } from './actor.model'

export type FollowState = 'pending' | 'accepted'

export interface ActorFollow {
  id: number
  follower: Actor & { hostRedundancyAllowed: boolean }
  following: Actor & { hostRedundancyAllowed: boolean }
  score: number
  state: FollowState
  createdAt: Date
  updatedAt: Date
}
