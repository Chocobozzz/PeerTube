import { VideoImportModel } from '@server/models/video/video-import'
import { PickWith } from '@server/typings/utils'
import { MUser, MVideo, MVideoAccountLight, MVideoTag, MVideoThumbnail, MVideoWithFile } from '@server/typings/models'

export type MVideoImport = Omit<VideoImportModel, 'User' | 'Video'>

export type MVideoImportDefault = MVideoImport &
  PickWith<VideoImportModel, 'User', MUser> &
  PickWith<VideoImportModel, 'Video', MVideoTag & MVideoAccountLight & MVideoThumbnail>

export type MVideoImportDefaultFiles = MVideoImportDefault &
  PickWith<VideoImportModel, 'Video', MVideoTag & MVideoAccountLight & MVideoThumbnail & MVideoWithFile>

export type MVideoImportVideo = MVideoImport &
  PickWith<VideoImportModel, 'Video', MVideo>
