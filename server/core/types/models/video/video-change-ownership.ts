import { VideoChangeOwnershipModel } from '@server/models/video/video-change-ownership.js'
import { PickWith } from '@peertube/peertube-typescript-utils'
import { MAccountDefault, MAccountFormattable } from '../account/account.js'
import { MVideoFormattable, MVideoWithAllFiles } from './video.js'

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
