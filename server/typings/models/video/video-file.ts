import { VideoFileModel } from '../../../models/video/video-file'
import { PickWith, PickWithOpt } from '../../utils'
import { MVideo, MVideoUUID } from './video'
import { MVideoRedundancyFileUrl } from './video-redundancy'

type Use<K extends keyof VideoFileModel, M> = PickWith<VideoFileModel, K, M>

// ############################################################################

export type MVideoFile = Omit<VideoFileModel, 'Video' | 'RedundancyVideos'>

export type MVideoFileVideo = MVideoFile &
  Use<'Video', MVideo>

export type MVideoFileVideoUUID = MVideoFile &
  Use<'Video', MVideoUUID>

export type MVideoFileRedundanciesOpt = MVideoFile &
  PickWithOpt<VideoFileModel, 'RedundancyVideos', MVideoRedundancyFileUrl[]>
