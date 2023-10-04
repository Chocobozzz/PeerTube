import { VideoSourceModel } from '@server/models/video/video-source.js'

export type MVideoSource = Omit<VideoSourceModel, 'Video'>
