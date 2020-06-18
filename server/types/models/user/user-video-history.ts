import { UserVideoHistoryModel } from '../../../models/account/user-video-history'

export type MUserVideoHistory = Omit<UserVideoHistoryModel, 'Video' | 'User'>

export type MUserVideoHistoryTime = Pick<MUserVideoHistory, 'currentTime'>
