import { VideoCaptionModel } from '../../../models/video/video-caption'
import { FunctionProperties, PickWith } from '@shared/core-utils'
import { MVideo, MVideoUUID } from './video'

type Use<K extends keyof VideoCaptionModel, M> = PickWith<VideoCaptionModel, K, M>

// ############################################################################

export type MVideoCaption = Omit<VideoCaptionModel, 'Video'>

// ############################################################################

export type MVideoCaptionLanguage = Pick<MVideoCaption, 'language'>
export type MVideoCaptionLanguageUrl = Pick<MVideoCaption, 'language' | 'fileUrl' | 'getFileUrl'>

export type MVideoCaptionVideo =
  MVideoCaption &
  Use<'Video', Pick<MVideo, 'id' | 'remote' | 'uuid'>>

// ############################################################################

// Format for API or AP object

export type MVideoCaptionFormattable =
  FunctionProperties<MVideoCaption> &
  Pick<MVideoCaption, 'language'> &
  Use<'Video', MVideoUUID>
