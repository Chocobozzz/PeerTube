import { VideoSourceModel } from '@server/models/video/video-source'

export type MVideoSourceFormattable = Pick<VideoSourceModel, 'filename'>
