import { VideoShareModel } from '../../models/video/video-share'

export type VideoShareModelOnly = Omit<VideoShareModel, 'Actor' | 'Video'>
