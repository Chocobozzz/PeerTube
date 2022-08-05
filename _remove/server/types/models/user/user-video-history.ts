import { UserVideoHistoryModel } from '../../../models/user/user-video-history'

export type MUserVideoHistory = Omit<UserVideoHistoryModel, 'Video' | 'User'>

export type MUserVideoHistoryTime = Pick<MUserVideoHistory, 'currentTime'>
