import { VideoImportModel } from '@server/models/video/video-import'
import { PickWith } from '@server/typings/utils'
import { MUser, MVideo, MVideoAccountLight, MVideoTag, MVideoThumbnail, MVideoWithFile } from '@server/typings/models'

type Use<K extends keyof VideoImportModel, M> = PickWith<VideoImportModel, K, M>

// ############################################################################

export type MVideoImport = Omit<VideoImportModel, 'User' | 'Video'>

export type MVideoImportVideo = MVideoImport &
  Use<'Video', MVideo>

// ############################################################################

type VideoAssociation = MVideoTag & MVideoAccountLight & MVideoThumbnail

export type MVideoImportDefault = MVideoImport &
  Use<'User', MUser> &
  Use<'Video', VideoAssociation>

export type MVideoImportDefaultFiles = MVideoImport &
  Use<'User', MUser> &
  Use<'Video', VideoAssociation & MVideoWithFile>
