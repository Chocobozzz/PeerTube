import { ThumbnailModel } from '../../../models/video/thumbnail'

export type MThumbnail = Omit<ThumbnailModel, 'Video' | 'VideoPlaylist'>
