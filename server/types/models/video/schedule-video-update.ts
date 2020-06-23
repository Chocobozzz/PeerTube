import { ScheduleVideoUpdateModel } from '../../../models/video/schedule-video-update'
import { PickWith } from '@shared/core-utils'
import { MVideoAPWithoutCaption, MVideoWithBlacklistLight } from './video'

type Use<K extends keyof ScheduleVideoUpdateModel, M> = PickWith<ScheduleVideoUpdateModel, K, M>

// ############################################################################

export type MScheduleVideoUpdate = Omit<ScheduleVideoUpdateModel, 'Video'>

// ############################################################################

export type MScheduleVideoUpdateVideoAll =
  MScheduleVideoUpdate &
  Use<'Video', MVideoAPWithoutCaption & MVideoWithBlacklistLight>

// Format for API or AP object

export type MScheduleVideoUpdateFormattable = Pick<MScheduleVideoUpdate, 'updateAt' | 'privacy'>
