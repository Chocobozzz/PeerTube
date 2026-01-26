import { PickWith } from '@peertube/peertube-typescript-utils'
import { VideoCaptionModel } from '../../../models/video/video-caption.js'
import { MVideo, MVideoOwned, MVideoPrivacy } from './video.js'

type Use<K extends keyof VideoCaptionModel, M> = PickWith<VideoCaptionModel, K, M>

// ############################################################################

export type MVideoCaption = Omit<VideoCaptionModel, 'Video'>

// ############################################################################

export type MVideoCaptionLanguage = Pick<MVideoCaption, 'language'>
export type MVideoCaptionFilename = Pick<MVideoCaption, 'filename' | 'getFileStaticPath' | 'm3u8Filename' | 'getM3U8StaticPath'>

export type MVideoCaptionUrl = Pick<
  MVideoCaption,
  'filename' | 'getFileStaticPath' | 'storage' | 'fileUrl' | 'm3u8Url' | 'getFileUrl' | 'getM3U8Url' | 'm3u8Filename' | 'getM3U8StaticPath'
>

export type MVideoCaptionLanguageUrl = Pick<
  MVideoCaption,
  | 'language'
  | 'fileUrl'
  | 'storage'
  | 'filename'
  | 'automaticallyGenerated'
  | 'm3u8Filename'
  | 'm3u8Url'
  | 'toActivityPubObject'
  | 'getFileUrl'
  | 'getFileStaticPath'
  | 'getOriginFileUrl'
  | 'getM3U8Url'
  | 'getM3U8StaticPath'
>

export type MVideoCaptionVideo =
  & MVideoCaption
  & Use<'Video', Pick<MVideo, 'id' | 'name' | 'remote' | 'uuid' | 'url' | 'state' | 'getWatchStaticPath' | 'isLocal' | 'privacy'>>

// ############################################################################

// Format for API or AP object

export type MVideoCaptionFormattable =
  & MVideoCaption
  & Pick<MVideoCaption, 'language'>
  & Use<'Video', MVideoOwned & MVideoPrivacy>
