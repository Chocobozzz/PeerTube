import * as Sequelize from 'sequelize'

import { AuthorInstance } from './author-interface'
import { VideoTagInstance } from './video-tag-interface'

// Don't use barrel, import just what we need
import { Video as FormatedVideo } from '../../../shared/models/video.model'

export type FormatedAddRemoteVideo = {
  name: string
  category: number
  licence: number
  language: number
  nsfw: boolean
  description: string
  infoHash: string
  remoteId: string
  author: string
  duration: number
  thumbnailData: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  extname: string
  views: number
  likes: number
  dislikes: number
}

export type FormatedUpdateRemoteVideo = {
  name: string
  category: number
  licence: number
  language: number
  nsfw: boolean
  description: string
  infoHash: string
  remoteId: string
  author: string
  duration: number
  tags: string[]
  createdAt: Date
  updatedAt: Date
  extname: string
  views: number
  likes: number
  dislikes: number
}

export namespace VideoMethods {
  export type GenerateMagnetUri = (this: VideoInstance) => string
  export type GetVideoFilename = (this: VideoInstance) => string
  export type GetThumbnailName = (this: VideoInstance) => string
  export type GetPreviewName = (this: VideoInstance) => string
  export type GetTorrentName = (this: VideoInstance) => string
  export type IsOwned = (this: VideoInstance) => boolean
  export type ToFormatedJSON = (this: VideoInstance) => FormatedVideo

  export type ToAddRemoteJSONCallback = (err: Error, videoFormated?: FormatedAddRemoteVideo) => void
  export type ToAddRemoteJSON = (this: VideoInstance, callback: ToAddRemoteJSONCallback) => void

  export type ToUpdateRemoteJSON = (this: VideoInstance) => FormatedUpdateRemoteVideo

  export type TranscodeVideofileCallback = (err: Error) => void
  export type TranscodeVideofile = (this: VideoInstance, callback: TranscodeVideofileCallback) => void

  export type GenerateThumbnailFromDataCallback = (err: Error, thumbnailName?: string) => void
  export type GenerateThumbnailFromData = (video: VideoInstance, thumbnailData: string, callback: GenerateThumbnailFromDataCallback) => void

  export type GetDurationFromFileCallback = (err: Error, duration?: number) => void
  export type GetDurationFromFile = (videoPath, callback) => void

  export type ListCallback = (err: Error, videoInstances: VideoInstance[]) => void
  export type List = (callback: ListCallback) => void

  export type ListForApiCallback = (err: Error, videoInstances?: VideoInstance[], total?: number) => void
  export type ListForApi = (start: number, count: number, sort: string, callback: ListForApiCallback) => void

  export type LoadByHostAndRemoteIdCallback = (err: Error, videoInstance: VideoInstance) => void
  export type LoadByHostAndRemoteId = (fromHost: string, remoteId: string, callback: LoadByHostAndRemoteIdCallback) => void

  export type ListOwnedAndPopulateAuthorAndTagsCallback = (err: Error, videoInstances: VideoInstance[]) => void
  export type ListOwnedAndPopulateAuthorAndTags = (callback: ListOwnedAndPopulateAuthorAndTagsCallback) => void

  export type ListOwnedByAuthorCallback = (err: Error, videoInstances: VideoInstance[]) => void
  export type ListOwnedByAuthor = (author: string, callback: ListOwnedByAuthorCallback) => void

  export type LoadCallback = (err: Error, videoInstance: VideoInstance) => void
  export type Load = (id: string, callback: LoadCallback) => void

  export type LoadAndPopulateAuthorCallback = (err: Error, videoInstance: VideoInstance) => void
  export type LoadAndPopulateAuthor = (id: string, callback: LoadAndPopulateAuthorCallback) => void

  export type LoadAndPopulateAuthorAndPodAndTagsCallback = (err: Error, videoInstance: VideoInstance) => void
  export type LoadAndPopulateAuthorAndPodAndTags = (id: string, callback: LoadAndPopulateAuthorAndPodAndTagsCallback) => void

  export type SearchAndPopulateAuthorAndPodAndTagsCallback = (err: Error, videoInstances?: VideoInstance[], total?: number) => void
  export type SearchAndPopulateAuthorAndPodAndTags = (value: string, field: string, start: number, count: number, sort: string, callback: SearchAndPopulateAuthorAndPodAndTagsCallback) => void
}

export interface VideoClass {
  generateMagnetUri: VideoMethods.GenerateMagnetUri
  getVideoFilename: VideoMethods.GetVideoFilename
  getThumbnailName: VideoMethods.GetThumbnailName
  getPreviewName: VideoMethods.GetPreviewName
  getTorrentName: VideoMethods.GetTorrentName
  isOwned: VideoMethods.IsOwned
  toFormatedJSON: VideoMethods.ToFormatedJSON
  toAddRemoteJSON: VideoMethods.ToAddRemoteJSON
  toUpdateRemoteJSON: VideoMethods.ToUpdateRemoteJSON
  transcodeVideofile: VideoMethods.TranscodeVideofile

  generateThumbnailFromData: VideoMethods.GenerateThumbnailFromData
  getDurationFromFile: VideoMethods.GetDurationFromFile
  list: VideoMethods.List
  listForApi: VideoMethods.ListForApi
  loadByHostAndRemoteId: VideoMethods.LoadByHostAndRemoteId
  listOwnedAndPopulateAuthorAndTags: VideoMethods.ListOwnedAndPopulateAuthorAndTags
  listOwnedByAuthor: VideoMethods.ListOwnedByAuthor
  load: VideoMethods.Load
  loadAndPopulateAuthor: VideoMethods.LoadAndPopulateAuthor
  loadAndPopulateAuthorAndPodAndTags: VideoMethods.LoadAndPopulateAuthorAndPodAndTags
  searchAndPopulateAuthorAndPodAndTags: VideoMethods.SearchAndPopulateAuthorAndPodAndTags
}

export interface VideoAttributes {
  name: string
  extname: string
  remoteId: string
  category: number
  licence: number
  language: number
  nsfw: boolean
  description: string
  infoHash?: string
  duration: number
  views?: number
  likes?: number
  dislikes?: number

  Author?: AuthorInstance
  Tags?: VideoTagInstance[]
}

export interface VideoInstance extends VideoClass, VideoAttributes, Sequelize.Instance<VideoAttributes> {
  id: string
  createdAt: Date
  updatedAt: Date

  generateMagnetUri: VideoMethods.GenerateMagnetUri
  getVideoFilename: VideoMethods.GetVideoFilename
  getThumbnailName: VideoMethods.GetThumbnailName
  getPreviewName: VideoMethods.GetPreviewName
  getTorrentName: VideoMethods.GetTorrentName
  isOwned: VideoMethods.IsOwned
  toFormatedJSON: VideoMethods.ToFormatedJSON
  toAddRemoteJSON: VideoMethods.ToAddRemoteJSON
  toUpdateRemoteJSON: VideoMethods.ToUpdateRemoteJSON
  transcodeVideofile: VideoMethods.TranscodeVideofile
}

export interface VideoModel extends VideoClass, Sequelize.Model<VideoInstance, VideoAttributes> {}
