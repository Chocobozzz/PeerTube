import { VideoShareModel } from '../../../models/video/video-share'
import { PickWith } from '../../utils'
import { MActorDefault } from '../account'
import { MVideo } from './video'

export type MVideoShare = Omit<VideoShareModel, 'Actor' | 'Video'>

export type MVideoShareActor = MVideoShare &
  PickWith<VideoShareModel, 'Actor', MActorDefault>

export type MVideoShareFull = MVideoShareActor &
  PickWith<VideoShareModel, 'Video', MVideo>
