import { VideoCaptionModel } from '../../../models/video/video-caption'
import { PickWith } from '@server/typings/utils'
import { VideoModel } from '@server/models/video/video'

type Use<K extends keyof VideoCaptionModel, M> = PickWith<VideoCaptionModel, K, M>

// ############################################################################

export type MVideoCaption = Omit<VideoCaptionModel, 'Video'>

// ############################################################################

export type MVideoCaptionLanguage = Pick<MVideoCaption, 'language'>

export type MVideoCaptionVideo = MVideoCaption &
  Use<'Video', Pick<VideoModel, 'id' | 'remote' | 'uuid'>>
