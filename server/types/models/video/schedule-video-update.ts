import { ScheduleVideoUpdateModel } from '../../../models/video/schedule-video-update'

// ############################################################################

export type MScheduleVideoUpdate = Omit<ScheduleVideoUpdateModel, 'Video'>

// ############################################################################

// Format for API or AP object

export type MScheduleVideoUpdateFormattable = Pick<MScheduleVideoUpdate, 'updateAt' | 'privacy'>
