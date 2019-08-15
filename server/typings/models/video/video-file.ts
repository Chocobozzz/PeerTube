import { VideoFileModel } from '../../../models/video/video-file'
import { PickWith, PickWithOpt } from '../../utils'
import { MVideo, MVideoUUID } from './video'
import { MVideoRedundancyFileUrl } from './video-redundancy'

export type MVideoFile = Omit<VideoFileModel, 'Video' | 'RedundancyVideos'>

export type MVideoFileVideo = MVideoFile &
  PickWith<VideoFileModel, 'Video', MVideo>

export type MVideoFileVideoUUID = MVideoFile &
  PickWith<VideoFileModel, 'Video', MVideoUUID>

export type MVideoFileRedundanciesOpt = MVideoFile &
  PickWithOpt<VideoFileModel, 'RedundancyVideos', MVideoRedundancyFileUrl[]>
