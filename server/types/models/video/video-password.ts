import { VideoPasswordModel } from '@server/models/video/video-password'

export type MVideoPassword = Omit<VideoPasswordModel, 'Video'>
