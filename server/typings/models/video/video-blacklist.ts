import { VideoBlacklistModel } from '../../../models/video/video-blacklist'
import { PickWith } from '@server/typings/utils'
import { MVideo } from '@server/typings/models'

export type MVideoBlacklist = Omit<VideoBlacklistModel, 'Video'>

export type MVideoBlacklistLight = Pick<MVideoBlacklist, 'id' | 'reason' | 'unfederated'>
export type MVideoBlacklistUnfederated = Pick<MVideoBlacklist, 'unfederated'>

export type MVideoBlacklistVideo = MVideoBlacklist &
  PickWith<VideoBlacklistModel, 'Video', MVideo>
