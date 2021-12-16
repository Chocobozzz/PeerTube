import { VideoImportModel } from '@server/models/video/video-import'
import { PickWith, PickWithOpt } from '@shared/typescript-utils'
import { MUser } from '../user/user'
import { MVideo, MVideoAccountLight, MVideoFormattable, MVideoTag, MVideoThumbnail, MVideoWithFile } from './video'

type Use<K extends keyof VideoImportModel, M> = PickWith<VideoImportModel, K, M>

// ############################################################################

export type MVideoImport = Omit<VideoImportModel, 'User' | 'Video'>

export type MVideoImportVideo =
  MVideoImport &
  Use<'Video', MVideo>

// ############################################################################

type VideoAssociation = MVideoTag & MVideoAccountLight & MVideoThumbnail

export type MVideoImportDefault =
  MVideoImport &
  Use<'User', MUser> &
  Use<'Video', VideoAssociation>

export type MVideoImportDefaultFiles =
  MVideoImport &
  Use<'User', MUser> &
  Use<'Video', VideoAssociation & MVideoWithFile>

// ############################################################################

// Format for API or AP object

export type MVideoImportFormattable =
  MVideoImport &
  PickWithOpt<VideoImportModel, 'Video', MVideoFormattable & MVideoTag>
