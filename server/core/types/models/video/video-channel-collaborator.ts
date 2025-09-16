import { PickWith } from '@peertube/peertube-typescript-utils'
import { VideoChannelCollaboratorModel } from '@server/models/video/video-channel-collaborator.js'
import { MAccountDefault } from '../account/account.js'

type Use<K extends keyof VideoChannelCollaboratorModel, M> = PickWith<VideoChannelCollaboratorModel, K, M>

// ############################################################################

export type MChannelCollaborator = Omit<VideoChannelCollaboratorModel, 'Account' | 'VideoChannel'>

export type MChannelCollaboratorAccount =
  & MChannelCollaborator
  & Use<'Account', MAccountDefault>
