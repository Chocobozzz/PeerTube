import { VideoLiveReplaySettingModel } from '@server/models/video/video-live-replay-setting'

export type MLiveReplaySetting = Omit<VideoLiveReplaySettingModel, 'VideoLive' | 'VideoLiveSession'>
