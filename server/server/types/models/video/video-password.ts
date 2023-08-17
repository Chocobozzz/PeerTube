import { VideoPasswordModel } from '@server/models/video/video-password.js'

export type MVideoPassword = Omit<VideoPasswordModel, 'Video'>
