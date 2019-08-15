import { VideoCaptionModel } from '../../../models/video/video-caption'
import { PickWith } from '@server/typings/utils'
import { VideoModel } from '@server/models/video/video'

export type MVideoCaption = Omit<VideoCaptionModel, 'Video'>

export type MVideoCaptionLanguage = Pick<MVideoCaption, 'language'>

export type MVideoCaptionVideo = MVideoCaption &
  PickWith<VideoCaptionModel, 'Video', Pick<VideoModel, 'id' | 'remote' | 'uuid'>>
