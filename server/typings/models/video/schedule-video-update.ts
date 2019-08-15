import { ScheduleVideoUpdateModel } from '../../../models/video/schedule-video-update'

export type MScheduleVideoUpdate = Omit<ScheduleVideoUpdateModel, 'Video'>
