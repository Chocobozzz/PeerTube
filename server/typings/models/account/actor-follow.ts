import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import { MActor, MActorAccountChannel, MActorChannel, MActorChannelAccount, MActorDefault, MActorHost, MActorUsername } from './actor'
import { PickWith } from '../../utils'

export type MActorFollow = Omit<ActorFollowModel, 'ActorFollower' | 'ActorFollowing'>

export type MActorFollowActors = MActorFollow &
  PickWith<ActorFollowModel, 'ActorFollower', MActor> &
  PickWith<ActorFollowModel, 'ActorFollowing', MActor>

export type MActorFollowActorsDefault = MActorFollow &
  PickWith<ActorFollowModel, 'ActorFollower', MActorDefault> &
  PickWith<ActorFollowModel, 'ActorFollowing', MActorDefault>

export type MActorFollowActorsDefaultSubscription = MActorFollow &
  PickWith<ActorFollowModel, 'ActorFollower', MActorDefault> &
  PickWith<ActorFollowModel, 'ActorFollowing', MActorDefault & MActorChannel>

export type MActorFollowFull = MActorFollow &
  PickWith<ActorFollowModel, 'ActorFollower', MActorAccountChannel> &
  PickWith<ActorFollowModel, 'ActorFollowing', MActorAccountChannel>

export type MActorFollowFollowingHost = MActorFollow &
  PickWith<ActorFollowModel, 'ActorFollowing', MActorUsername & MActorHost>

export type MActorFollowSubscriptions = MActorFollow &
  PickWith<ActorFollowModel, 'ActorFollowing', MActorChannelAccount>
