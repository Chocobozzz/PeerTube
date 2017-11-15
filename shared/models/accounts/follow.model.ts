export type FollowState = 'pending' | 'accepted'

export interface AccountFollow {
  id: number
  name: string
  score?: number // Used for followers
  host: string
}
