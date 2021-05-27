import { FunctionProperties, PickWith, PickWithOpt } from '@shared/core-utils'
import { VideoChannelModel } from '../../../models/video/video-channel'
import {
  MAccountActor,
  MAccountAPI,
  MAccountDefault,
  MAccountFormattable,
  MAccountLight,
  MAccountSummaryBlocks,
  MAccountSummaryFormattable,
  MAccountUrl,
  MAccountUserId
} from '../account'
import {
  MActor,
  MActorAccountChannelId,
  MActorAPChannel,
  MActorAPI,
  MActorDefault,
  MActorDefaultBanner,
  MActorDefaultLight,
  MActorFormattable,
  MActorHost,
  MActorLight,
  MActorSummary,
  MActorSummaryFormattable,
  MActorUrl
} from '../actor'
import { MVideo } from './video'

type Use<K extends keyof VideoChannelModel, M> = PickWith<VideoChannelModel, K, M>

// ############################################################################

export type MChannel = Omit<VideoChannelModel, 'Actor' | 'Account' | 'Videos' | 'VideoPlaylists'>

// ############################################################################

export type MChannelId = Pick<MChannel, 'id'>

// ############################################################################

export type MChannelIdActor =
  MChannelId &
  Use<'Actor', MActorAccountChannelId>

export type MChannelUserId =
  Pick<MChannel, 'accountId'> &
  Use<'Account', MAccountUserId>

export type MChannelActor =
  MChannel &
  Use<'Actor', MActor>

export type MChannelUrl = Use<'Actor', MActorUrl>

// Default scope
export type MChannelDefault =
  MChannel &
  Use<'Actor', MActorDefault>

export type MChannelBannerDefault =
  MChannel &
  Use<'Actor', MActorDefaultBanner>

// ############################################################################

// Not all association attributes

export type MChannelActorLight =
  MChannel &
  Use<'Actor', MActorLight>

export type MChannelAccountLight =
  MChannel &
  Use<'Actor', MActorDefaultLight> &
  Use<'Account', MAccountLight>

export type MChannelHost =
  MChannelId &
  Use<'Actor', MActorHost>

// ############################################################################

// Account associations

export type MChannelAccountActor =
  MChannel &
  Use<'Account', MAccountActor>

export type MChannelBannerAccountDefault =
  MChannel &
  Use<'Actor', MActorDefaultBanner> &
  Use<'Account', MAccountDefault>

export type MChannelAccountDefault =
  MChannel &
  Use<'Actor', MActorDefault> &
  Use<'Account', MAccountDefault>

// ############################################################################

// Videos associations
export type MChannelVideos =
  MChannel &
  Use<'Videos', MVideo[]>

// ############################################################################

// For API

export type MChannelSummary =
  FunctionProperties<MChannel> &
  Pick<MChannel, 'id' | 'name' | 'description' | 'actorId'> &
  Use<'Actor', MActorSummary>

export type MChannelSummaryAccount =
  MChannelSummary &
  Use<'Account', MAccountSummaryBlocks>

export type MChannelAPI =
  MChannel &
  Use<'Actor', MActorAPI> &
  Use<'Account', MAccountAPI>

// ############################################################################

// Format for API or AP object

export type MChannelSummaryFormattable =
  FunctionProperties<MChannel> &
  Pick<MChannel, 'id' | 'name'> &
  Use<'Actor', MActorSummaryFormattable>

export type MChannelAccountSummaryFormattable =
  MChannelSummaryFormattable &
  Use<'Account', MAccountSummaryFormattable>

export type MChannelFormattable =
  FunctionProperties<MChannel> &
  Pick<MChannel, 'id' | 'name' | 'description' | 'createdAt' | 'updatedAt' | 'support'> &
  Use<'Actor', MActorFormattable> &
  PickWithOpt<VideoChannelModel, 'Account', MAccountFormattable>

export type MChannelAP =
  Pick<MChannel, 'name' | 'description' | 'support'> &
  Use<'Actor', MActorAPChannel> &
  Use<'Account', MAccountUrl>
