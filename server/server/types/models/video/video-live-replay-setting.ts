import { VideoLiveReplaySettingModel } from '@server/models/video/video-live-replay-setting.js'

export type MLiveReplaySetting = Omit<VideoLiveReplaySettingModel, 'VideoLive' | 'VideoLiveSession'>
