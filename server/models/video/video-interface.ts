import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { AuthorInstance } from './author-interface'
import { TagAttributes, TagInstance } from './tag-interface'

// Don't use barrel, import just what we need
import { Video as FormatedVideo } from '../../../shared/models/video.model'
import { ResultList } from '../../../shared/models/result-list.model'

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

  export type ToAddRemoteJSON = (this: VideoInstance) => Promise<FormatedAddRemoteVideo>
  export type ToUpdateRemoteJSON = (this: VideoInstance) => FormatedUpdateRemoteVideo

  export type TranscodeVideofile = (this: VideoInstance) => Promise<void>

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

  export type Load = (id: string) => Promise<VideoInstance>
  export type LoadByHostAndRemoteId = (fromHost: string, remoteId: string) => Promise<VideoInstance>
  export type LoadAndPopulateAuthor = (id: string) => Promise<VideoInstance>
  export type LoadAndPopulateAuthorAndPodAndTags = (id: string) => Promise<VideoInstance>
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
  Tags?: TagInstance[]
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

  setTags: Sequelize.HasManySetAssociationsMixin<TagAttributes, string>
}

export interface VideoModel extends VideoClass, Sequelize.Model<VideoInstance, VideoAttributes> {}
