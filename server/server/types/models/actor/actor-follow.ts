import { PickWith } from '@peertube/peertube-typescript-utils'
import { ActorFollowModel } from '../../../models/actor/actor-follow.js'
import {
  MActor,
  MActorChannelAccountActor,
  MActorDefault,
  MActorDefaultAccountChannel,
  MActorDefaultChannelId,
  MActorFormattable,
  MActorHostOnly,
  MActorUsername
} from './actor.js'

type Use<K extends keyof ActorFollowModel, M> = PickWith<ActorFollowModel, K, M>

// ############################################################################

export type MActorFollow = Omit<ActorFollowModel, 'ActorFollower' | 'ActorFollowing'>

// ############################################################################

export type MActorFollowFollowingHost =
  MActorFollow &
  Use<'ActorFollowing', MActorUsername & MActorHostOnly>

// ############################################################################

// With actors or actors default

export type MActorFollowActors =
  MActorFollow &
  Use<'ActorFollower', MActor> &
  Use<'ActorFollowing', MActor>

export type MActorFollowActorsDefault =
  MActorFollow &
  Use<'ActorFollower', MActorDefault> &
  Use<'ActorFollowing', MActorDefault>

export type MActorFollowFull =
  MActorFollow &
  Use<'ActorFollower', MActorDefaultAccountChannel> &
  Use<'ActorFollowing', MActorDefaultAccountChannel>

// ############################################################################

// For subscriptions

export type MActorFollowActorsDefaultSubscription =
  MActorFollow &
  Use<'ActorFollower', MActorDefault> &
  Use<'ActorFollowing', MActorDefaultChannelId>

export type MActorFollowSubscriptions =
  MActorFollow &
  Use<'ActorFollowing', MActorChannelAccountActor>

// ############################################################################

// Format for API or AP object

export type MActorFollowFormattable =
  Pick<MActorFollow, 'id' | 'score' | 'state' | 'createdAt' | 'updatedAt'> &
  Use<'ActorFollower', MActorFormattable> &
  Use<'ActorFollowing', MActorFormattable>
