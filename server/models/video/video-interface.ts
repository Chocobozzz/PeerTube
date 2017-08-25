import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { AuthorInstance } from './author-interface'
import { TagAttributes, TagInstance } from './tag-interface'
import { VideoFileAttributes, VideoFileInstance } from './video-file-interface'

// Don't use barrel, import just what we need
import { Video as FormattedVideo } from '../../../shared/models/videos/video.model'
import { ResultList } from '../../../shared/models/result-list.model'

export type FormattedRemoteVideoFile = {
  infoHash: string
  resolution: number
  extname: string
  size: number
}

export type FormattedAddRemoteVideo = {
  uuid: string
  name: string
  category: number
  licence: number
  language: number
  nsfw: boolean
  description: string
  author: string
  duration: number
  thumbnailData: string
  tags: string[]
  createdAt: Date
  updatedAt: Date
  views: number
  likes: number
  dislikes: number
  files: FormattedRemoteVideoFile[]
}

export type FormattedUpdateRemoteVideo = {
  uuid: string
  name: string
  category: number
  licence: number
  language: number
  nsfw: boolean
  description: string
  author: string
  duration: number
  tags: string[]
  createdAt: Date
  updatedAt: Date
  views: number
  likes: number
  dislikes: number
  files: FormattedRemoteVideoFile[]
}

export namespace VideoMethods {
  export type GetThumbnailName = (this: VideoInstance) => string
  export type GetPreviewName = (this: VideoInstance) => string
  export type IsOwned = (this: VideoInstance) => boolean
  export type ToFormattedJSON = (this: VideoInstance) => FormattedVideo

  export type GenerateMagnetUri = (this: VideoInstance, videoFile: VideoFileInstance) => string
  export type GetTorrentFileName = (this: VideoInstance, videoFile: VideoFileInstance) => string
  export type GetVideoFilename = (this: VideoInstance, videoFile: VideoFileInstance) => string
  export type CreatePreview = (this: VideoInstance, videoFile: VideoFileInstance) => Promise<string>
  export type CreateThumbnail = (this: VideoInstance, videoFile: VideoFileInstance) => Promise<string>
  export type GetVideoFilePath = (this: VideoInstance, videoFile: VideoFileInstance) => string
  export type CreateTorrentAndSetInfoHash = (this: VideoInstance, videoFile: VideoFileInstance) => Promise<void>

  export type ToAddRemoteJSON = (this: VideoInstance) => Promise<FormattedAddRemoteVideo>
  export type ToUpdateRemoteJSON = (this: VideoInstance) => FormattedUpdateRemoteVideo

  export type TranscodeVideofile = (this: VideoInstance, inputVideoFile: VideoFileInstance) => Promise<void>

  // Return thumbnail name
  export type GenerateThumbnailFromData = (video: VideoInstance, thumbnailData: string) => Promise<string>
  export type GetDurationFromFile = (videoPath: string) => Promise<number>

  export type List = () => Promise<VideoInstance[]>
  export type ListOwnedAndPopulateAuthorAndTags = () => Promise<VideoInstance[]>
  export type ListOwnedByAuthor = (author: string) => Promise<VideoInstance[]>

  export type ListForApi = (start: number, count: number, sort: string) => Promise< ResultList<VideoInstance> >
  export type SearchAndPopulateAuthorAndPodAndTags = (
    value: string,
    field: string,
    start: number,
    count: number,
    sort: string
  ) => Promise< ResultList<VideoInstance> >

  export type Load = (id: number) => Promise<VideoInstance>
  export type LoadByUUID = (uuid: string) => Promise<VideoInstance>
  export type LoadByHostAndUUID = (fromHost: string, uuid: string) => Promise<VideoInstance>
  export type LoadAndPopulateAuthor = (id: number) => Promise<VideoInstance>
  export type LoadAndPopulateAuthorAndPodAndTags = (id: number) => Promise<VideoInstance>
  export type LoadByUUIDAndPopulateAuthorAndPodAndTags = (uuid: string) => Promise<VideoInstance>

  export type RemoveThumbnail = (this: VideoInstance) => Promise<void>
  export type RemovePreview = (this: VideoInstance) => Promise<void>
  export type RemoveFile = (this: VideoInstance, videoFile: VideoFileInstance) => Promise<void>
  export type RemoveTorrent = (this: VideoInstance, videoFile: VideoFileInstance) => Promise<void>
}

export interface VideoClass {
  generateThumbnailFromData: VideoMethods.GenerateThumbnailFromData
  getDurationFromFile: VideoMethods.GetDurationFromFile
  list: VideoMethods.List
  listForApi: VideoMethods.ListForApi
  listOwnedAndPopulateAuthorAndTags: VideoMethods.ListOwnedAndPopulateAuthorAndTags
  listOwnedByAuthor: VideoMethods.ListOwnedByAuthor
  load: VideoMethods.Load
  loadAndPopulateAuthor: VideoMethods.LoadAndPopulateAuthor
  loadAndPopulateAuthorAndPodAndTags: VideoMethods.LoadAndPopulateAuthorAndPodAndTags
  loadByHostAndUUID: VideoMethods.LoadByHostAndUUID
  loadByUUID: VideoMethods.LoadByUUID
  loadByUUIDAndPopulateAuthorAndPodAndTags: VideoMethods.LoadByUUIDAndPopulateAuthorAndPodAndTags
  searchAndPopulateAuthorAndPodAndTags: VideoMethods.SearchAndPopulateAuthorAndPodAndTags
}

export interface VideoAttributes {
  uuid?: string
  name: string
  category: number
  licence: number
  language: number
  nsfw: boolean
  description: string
  duration: number
  views?: number
  likes?: number
  dislikes?: number
  remote: boolean

  Author?: AuthorInstance
  Tags?: TagInstance[]
  VideoFiles?: VideoFileInstance[]
}

export interface VideoInstance extends VideoClass, VideoAttributes, Sequelize.Instance<VideoAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  createPreview: VideoMethods.CreatePreview
  createThumbnail: VideoMethods.CreateThumbnail
  createTorrentAndSetInfoHash: VideoMethods.CreateTorrentAndSetInfoHash
  generateMagnetUri: VideoMethods.GenerateMagnetUri
  getPreviewName: VideoMethods.GetPreviewName
  getThumbnailName: VideoMethods.GetThumbnailName
  getTorrentFileName: VideoMethods.GetTorrentFileName
  getVideoFilename: VideoMethods.GetVideoFilename
  getVideoFilePath: VideoMethods.GetVideoFilePath
  isOwned: VideoMethods.IsOwned
  removeFile: VideoMethods.RemoveFile
  removePreview: VideoMethods.RemovePreview
  removeThumbnail: VideoMethods.RemoveThumbnail
  removeTorrent: VideoMethods.RemoveTorrent
  toAddRemoteJSON: VideoMethods.ToAddRemoteJSON
  toFormattedJSON: VideoMethods.ToFormattedJSON
  toUpdateRemoteJSON: VideoMethods.ToUpdateRemoteJSON
  transcodeVideofile: VideoMethods.TranscodeVideofile

  setTags: Sequelize.HasManySetAssociationsMixin<TagAttributes, string>
  setVideoFiles: Sequelize.HasManySetAssociationsMixin<VideoFileAttributes, string>
}

export interface VideoModel extends VideoClass, Sequelize.Model<VideoInstance, VideoAttributes> {}
