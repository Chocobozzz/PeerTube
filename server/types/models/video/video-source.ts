import { VideoSourceModel } from '@server/models/video/video-source'

export type MVideoSource = Pick<VideoSourceModel, 'filename'>
