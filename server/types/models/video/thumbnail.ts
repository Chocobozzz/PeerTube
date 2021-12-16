import { PickWith } from '@shared/typescript-utils'
import { ThumbnailModel } from '../../../models/video/thumbnail'
import { MVideo } from './video'

type Use<K extends keyof ThumbnailModel, M> = PickWith<ThumbnailModel, K, M>

// ############################################################################

export type MThumbnail = Omit<ThumbnailModel, 'Video' | 'VideoPlaylist'>

// ############################################################################

export type MThumbnailVideo =
  MThumbnail &
  Use<'Video', MVideo>
