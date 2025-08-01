import { VideoLiveScheduleModel } from '@server/models/video/video-live-schedule.js'

export type MLiveSchedule = Omit<VideoLiveScheduleModel, 'VideoLive'>
