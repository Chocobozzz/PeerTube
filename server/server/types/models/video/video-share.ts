import { PickWith } from '@peertube/peertube-typescript-utils'
import { VideoShareModel } from '../../../models/video/video-share.js'
import { MActorDefault } from '../actor/index.js'
import { MVideo } from './video.js'

type Use<K extends keyof VideoShareModel, M> = PickWith<VideoShareModel, K, M>

// ############################################################################

export type MVideoShare = Omit<VideoShareModel, 'Actor' | 'Video'>

export type MVideoShareActor =
  MVideoShare &
  Use<'Actor', MActorDefault>

export type MVideoShareFull =
  MVideoShare &
  Use<'Actor', MActorDefault> &
  Use<'Video', MVideo>
