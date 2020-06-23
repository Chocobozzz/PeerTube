import { VideoShareModel } from '../../../models/video/video-share'
import { PickWith } from '@shared/core-utils'
import { MActorDefault } from '../account'
import { MVideo } from './video'

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
