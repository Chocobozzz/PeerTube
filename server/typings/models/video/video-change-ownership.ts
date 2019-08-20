import { VideoChangeOwnershipModel } from '@server/models/video/video-change-ownership'
import { PickWith } from '@server/typings/utils'
import { MAccountDefault, MVideoWithFileThumbnail } from '@server/typings/models'

type Use<K extends keyof VideoChangeOwnershipModel, M> = PickWith<VideoChangeOwnershipModel, K, M>

// ############################################################################

export type MVideoChangeOwnership = Omit<VideoChangeOwnershipModel, 'Initiator' | 'NextOwner' | 'Video'>

export type MVideoChangeOwnershipFull = MVideoChangeOwnership &
  Use<'Initiator', MAccountDefault> &
  Use<'NextOwner', MAccountDefault> &
  Use<'Video', MVideoWithFileThumbnail>
