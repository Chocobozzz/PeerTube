import { PickWith } from '@peertube/peertube-typescript-utils'
import { ChangeOwnershipModel } from '@server/models/video/change-ownership.js'
import { MAccountFormattable } from '../account/account.js'
import { MChannelSummary } from './video-channel.js'
import { MVideoSummary } from './video.js'

type Use<K extends keyof ChangeOwnershipModel, M> = PickWith<ChangeOwnershipModel, K, M>

// ############################################################################

export type MChangeOwnership = Omit<ChangeOwnershipModel, 'Initiator' | 'NextOwner' | 'Video' | 'VideoChannel'>

export type MChangeOwnershipFull =
  & MChangeOwnership
  & Use<'Initiator', MAccountFormattable>
  & Use<'NextOwner', MAccountFormattable>
  & Use<'Video', MVideoSummary>
  & Use<'VideoChannel', MChannelSummary>
