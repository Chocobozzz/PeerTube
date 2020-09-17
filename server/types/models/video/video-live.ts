import { VideoLiveModel } from '@server/models/video/video-live'
import { PickWith } from '@shared/core-utils'
import { MVideo } from './video'

type Use<K extends keyof VideoLiveModel, M> = PickWith<VideoLiveModel, K, M>

// ############################################################################

export type MVideoLive = Omit<VideoLiveModel, 'Video'>

// ############################################################################

export type MVideoLiveVideo =
  MVideoLive &
  Use<'Video', MVideo>
