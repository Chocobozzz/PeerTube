import { VideoChangeOwnershipModel } from '@server/models/video/video-change-ownership'
import { PickWith } from '@server/typings/utils'
import { MAccountDefault, MVideoWithFileThumbnail } from '@server/typings/models'

export type MVideoChangeOwnership = Omit<VideoChangeOwnershipModel, 'Initiator' | 'NextOwner' | 'Video'>

export type MVideoChangeOwnershipFull = MVideoChangeOwnership &
  PickWith<VideoChangeOwnershipModel, 'Initiator', MAccountDefault> &
  PickWith<VideoChangeOwnershipModel, 'NextOwner', MAccountDefault> &
  PickWith<VideoChangeOwnershipModel, 'Video', MVideoWithFileThumbnail>
