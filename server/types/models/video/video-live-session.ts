import { VideoLiveSessionModel } from '@server/models/video/video-live-session'
import { PickWith } from '@shared/typescript-utils'
import { MVideo } from './video'

type Use<K extends keyof VideoLiveSessionModel, M> = PickWith<VideoLiveSessionModel, K, M>

// ############################################################################

export type MVideoLiveSession = Omit<VideoLiveSessionModel, 'Video' | 'VideoLive'>

// ############################################################################

export type MVideoLiveSessionReplay =
  MVideoLiveSession &
  Use<'ReplayVideo', MVideo>
