import { ActorFollowModel } from '../../../models/activitypub/actor-follow'
import {
  MActor,
  MActorAccount,
  MActorAccountChannel,
  MActorChannel,
  MActorChannelAccountActor,
  MActorDefault,
  MActorHost,
  MActorUsername
} from './actor'
import { PickWith } from '../../utils'
import { ActorModel } from '@server/models/activitypub/actor'

type Use<K extends keyof ActorFollowModel, M> = PickWith<ActorFollowModel, K, M>

// ############################################################################

export type MActorFollow = Omit<ActorFollowModel, 'ActorFollower' | 'ActorFollowing'>

// ############################################################################

export type MActorFollowFollowingHost = MActorFollow &
  Use<'ActorFollowing', MActorUsername & MActorHost>

// ############################################################################

// With actors or actors default

export type MActorFollowActors = MActorFollow &
  Use<'ActorFollower', MActor> &
  Use<'ActorFollowing', MActor>

export type MActorFollowActorsDefault = MActorFollow &
  Use<'ActorFollower', MActorDefault> &
  Use<'ActorFollowing', MActorDefault>

export type MActorFollowFull = MActorFollow &
  Use<'ActorFollower', MActorAccountChannel> &
  Use<'ActorFollowing', MActorAccountChannel>

// ############################################################################

// For subscriptions

export type MActorFollowActorsDefaultSubscription = MActorFollow &
  Use<'ActorFollower', MActorDefault> &
  Use<'ActorFollowing', MActorDefault & MActorChannel>

export type MActorFollowFollowingFullFollowerAccount = MActorFollow &
  Use<'ActorFollower', MActorAccount> &
  Use<'ActorFollowing', MActorAccountChannel>

export type MActorFollowSubscriptions = MActorFollow &
  Use<'ActorFollowing', MActorChannelAccountActor>
