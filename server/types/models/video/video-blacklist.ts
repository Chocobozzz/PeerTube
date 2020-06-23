import { VideoBlacklistModel } from '../../../models/video/video-blacklist'
import { PickWith } from '@shared/core-utils'
import { MVideo, MVideoFormattable } from './video'

type Use<K extends keyof VideoBlacklistModel, M> = PickWith<VideoBlacklistModel, K, M>

// ############################################################################

export type MVideoBlacklist = Omit<VideoBlacklistModel, 'Video'>

export type MVideoBlacklistLight = Pick<MVideoBlacklist, 'id' | 'reason' | 'unfederated'>
export type MVideoBlacklistUnfederated = Pick<MVideoBlacklist, 'unfederated'>

// ############################################################################

export type MVideoBlacklistLightVideo =
  MVideoBlacklistLight &
  Use<'Video', MVideo>

export type MVideoBlacklistVideo =
  MVideoBlacklist &
  Use<'Video', MVideo>

// ############################################################################

// Format for API or AP object

export type MVideoBlacklistFormattable =
  MVideoBlacklist &
  Use<'Video', MVideoFormattable>
