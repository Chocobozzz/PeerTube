import { VideoLiveSessionModel } from '@server/models/video/video-live-session.js'
import { PickWith } from '@peertube/peertube-typescript-utils'
import { MVideo } from './video.js'
import { MLiveReplaySetting } from './video-live-replay-setting.js'

type Use<K extends keyof VideoLiveSessionModel, M> = PickWith<VideoLiveSessionModel, K, M>

// ############################################################################

export type MVideoLiveSession = Omit<VideoLiveSessionModel, 'Video' | 'VideoLive' | 'ReplaySetting'>

// ############################################################################

export type MVideoLiveSessionReplay =
  MVideoLiveSession &
  Use<'ReplayVideo', MVideo> &
  Use<'ReplaySetting', MLiveReplaySetting>
