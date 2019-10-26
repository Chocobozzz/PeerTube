import { VideoChangeOwnershipModel } from '@server/models/video/video-change-ownership'
import { PickWith } from '@server/typings/utils'
import { MAccountDefault, MAccountFormattable, MVideo, MVideoWithFileThumbnail } from '@server/typings/models'

type Use<K extends keyof VideoChangeOwnershipModel, M> = PickWith<VideoChangeOwnershipModel, K, M>

// ############################################################################

export type MVideoChangeOwnership = Omit<VideoChangeOwnershipModel, 'Initiator' | 'NextOwner' | 'Video'>

export type MVideoChangeOwnershipFull = MVideoChangeOwnership &
  Use<'Initiator', MAccountDefault> &
  Use<'NextOwner', MAccountDefault> &
  Use<'Video', MVideoWithFileThumbnail>

// ############################################################################

// Format for API or AP object

export type MVideoChangeOwnershipFormattable = Pick<MVideoChangeOwnership, 'id' | 'status' | 'createdAt'> &
  Use<'Initiator', MAccountFormattable> &
  Use<'NextOwner', MAccountFormattable> &
  Use<'Video', Pick<MVideo, 'id' | 'uuid' | 'url' | 'name'>>
