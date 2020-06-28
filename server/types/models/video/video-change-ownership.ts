import { VideoChangeOwnershipModel } from '@server/models/video/video-change-ownership'
import { PickWith } from '@shared/core-utils'
import { MAccountDefault, MAccountFormattable } from '../account/account'
import { MVideoWithAllFiles, MVideoFormattable } from './video'

type Use<K extends keyof VideoChangeOwnershipModel, M> = PickWith<VideoChangeOwnershipModel, K, M>

// ############################################################################

export type MVideoChangeOwnership = Omit<VideoChangeOwnershipModel, 'Initiator' | 'NextOwner' | 'Video'>

export type MVideoChangeOwnershipFull =
  MVideoChangeOwnership &
  Use<'Initiator', MAccountDefault> &
  Use<'NextOwner', MAccountDefault> &
  Use<'Video', MVideoWithAllFiles>

// ############################################################################

// Format for API or AP object

export type MVideoChangeOwnershipFormattable =
  Pick<MVideoChangeOwnership, 'id' | 'status' | 'createdAt'> &
  Use<'Initiator', MAccountFormattable> &
  Use<'NextOwner', MAccountFormattable> &
  Use<'Video', MVideoFormattable>
