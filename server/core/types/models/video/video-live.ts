import { VideoLiveModel } from '@server/models/video/video-live.js'
import { PickWith } from '@peertube/peertube-typescript-utils'
import { MVideo } from './video.js'
import { MLiveReplaySetting } from './video-live-replay-setting.js'
import { MLiveSchedule } from './video-live-schedule.js'

type Use<K extends keyof VideoLiveModel, M> = PickWith<VideoLiveModel, K, M>

// ############################################################################

export type MVideoLive = Omit<VideoLiveModel, 'Video' | 'ReplaySetting' | 'LiveSchedules'>

// ############################################################################

export type MVideoLiveVideo =
  & MVideoLive
  & Use<'Video', MVideo>

// ############################################################################

export type MVideoLiveWithSetting =
  & MVideoLive
  & Use<'ReplaySetting', MLiveReplaySetting>

export type MVideoLiveWithSettingSchedules =
  & MVideoLive
  & Use<'ReplaySetting', MLiveReplaySetting>
  & Use<'LiveSchedules', MLiveSchedule[]>

export type MVideoLiveWithSchedules =
  & MVideoLive
  & Use<'LiveSchedules', MLiveSchedule[]>

export type MVideoLiveVideoWithSetting =
  & MVideoLiveVideo
  & Use<'ReplaySetting', MLiveReplaySetting>

export type MVideoLiveVideoWithSettingSchedules =
  & MVideoLiveVideo
  & Use<'ReplaySetting', MLiveReplaySetting>
  & Use<'LiveSchedules', MLiveSchedule[]>
