import { PickWith } from '@peertube/peertube-typescript-utils'
import { VideoCaptionModel } from '../../../models/video/video-caption.js'
import { MVideo, MVideoUUID } from './video.js'

type Use<K extends keyof VideoCaptionModel, M> = PickWith<VideoCaptionModel, K, M>

// ############################################################################

export type MVideoCaption = Omit<VideoCaptionModel, 'Video'>

// ############################################################################

export type MVideoCaptionLanguage = Pick<MVideoCaption, 'language'>
export type MVideoCaptionLanguageUrl =
  Pick<MVideoCaption, 'language' | 'fileUrl' | 'filename' | 'automaticallyGenerated' | 'getFileUrl' | 'getCaptionStaticPath' |
  'toActivityPubObject'>

export type MVideoCaptionVideo =
  MVideoCaption &
  Use<'Video', Pick<MVideo, 'id' | 'name' | 'remote' | 'uuid' | 'url' | 'state' | 'getWatchStaticPath'>>

// ############################################################################

// Format for API or AP object

export type MVideoCaptionFormattable =
  MVideoCaption &
  Pick<MVideoCaption, 'language'> &
  Use<'Video', MVideoUUID>
