import { PickWith } from '@peertube/peertube-typescript-utils'
import { VideoChangeOwnershipModel } from '@server/models/video/video-change-ownership.js'
import { MAccountFormattable } from '../account/account.js'
import { MVideoFormattable } from './video.js'

type Use<K extends keyof VideoChangeOwnershipModel, M> = PickWith<VideoChangeOwnershipModel, K, M>

// ############################################################################

export type MVideoChangeOwnership = Omit<VideoChangeOwnershipModel, 'Initiator' | 'NextOwner' | 'Video'>

export type MVideoChangeOwnershipFull =
  & MVideoChangeOwnership
  & Use<'Initiator', MAccountFormattable>
  & Use<'NextOwner', MAccountFormattable>
  & Use<'Video', MVideoFormattable>
