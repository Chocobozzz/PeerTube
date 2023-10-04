import { PickWith } from '@peertube/peertube-typescript-utils'
import { ThumbnailModel } from '../../../models/video/thumbnail.js'
import { MVideo } from './video.js'

type Use<K extends keyof ThumbnailModel, M> = PickWith<ThumbnailModel, K, M>

// ############################################################################

export type MThumbnail = Omit<ThumbnailModel, 'Video' | 'VideoPlaylist'>

// ############################################################################

export type MThumbnailVideo =
  MThumbnail &
  Use<'Video', MVideo>
