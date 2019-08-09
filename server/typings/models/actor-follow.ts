import { ActorFollowModel } from '../../models/activitypub/actor-follow'
import { ActorModelOnly } from './actor'

export type ActorFollowModelOnly = Omit<ActorFollowModel, 'ActorFollower' | 'ActorFollowing'>
export type ActorFollowModelLight = ActorFollowModelOnly & {
  ActorFollower: ActorModelOnly
  ActorFollowing: ActorModelOnly
}
