import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { TagAttributes, TagInstance } from './tag-interface'
import { VideoFileAttributes, VideoFileInstance } from './video-file-interface'

// Don't use barrel, import just what we need
import {
  Video as FormattedVideo,
  VideoDetails as FormattedDetailsVideo
} from '../../../shared/models/videos/video.model'
import { RemoteVideoUpdateData } from '../../../shared/models/pods/remote-video/remote-video-update-request.model'
import { RemoteVideoCreateData } from '../../../shared/models/pods/remote-video/remote-video-create-request.model'
import { ResultList } from '../../../shared/models/result-list.model'
import { VideoChannelInstance } from './video-channel-interface'

export namespace VideoMethods {
  export type GetThumbnailName = (this: VideoInstance) => string
  export type GetPreviewName = (this: VideoInstance) => string
  export type IsOwned = (this: VideoInstance) => boolean
  export type ToFormattedJSON = (this: VideoInstance) => FormattedVideo
  export type ToFormattedDetailsJSON = (this: VideoInstance) => FormattedDetailsVideo

  export type GetOriginalFile = (this: VideoInstance) => VideoFileInstance
  export type GetTorrentFileName = (this: VideoInstance, videoFile: VideoFileInstance) => string
  export type GetVideoFilename = (this: VideoInstance, videoFile: VideoFileInstance) => string
  export type CreatePreview = (this: VideoInstance, videoFile: VideoFileInstance) => Promise<string>
  export type CreateThumbnail = (this: VideoInstance, videoFile: VideoFileInstance) => Promise<string>
  export type GetVideoFilePath = (this: VideoInstance, videoFile: VideoFileInstance) => string
  export type CreateTorrentAndSetInfoHash = (this: VideoInstance, videoFile: VideoFileInstance) => Promise<void>

  export type ToAddRemoteJSON = (this: VideoInstance) => Promise<RemoteVideoCreateData>
  export type ToUpdateRemoteJSON = (this: VideoInstance) => RemoteVideoUpdateData

  export type OptimizeOriginalVideofile = (this: VideoInstance) => Promise<void>
  export type TranscodeOriginalVideofile = (this: VideoInstance, resolution: number) => Promise<void>
  export type GetOriginalFileHeight = (this: VideoInstance) => Promise<number>
  export type GetEmbedPath = (this: VideoInstance) => string
  export type GetThumbnailPath = (this: VideoInstance) => string
  export type GetPreviewPath = (this: VideoInstance) => string

  // Return thumbnail name
  export type GenerateThumbnailFromData = (video: VideoInstance, thumbnailData: string) => Promise<string>

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
  export type LoadByUUID = (uuid: string, t?: Sequelize.Transaction) => Promise<VideoInstance>
  export type LoadLocalVideoByUUID = (uuid: string, t?: Sequelize.Transaction) => Promise<VideoInstance>
  export type LoadByHostAndUUID = (fromHost: string, uuid: string, t?: Sequelize.Transaction) => Promise<VideoInstance>
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
  list: VideoMethods.List
  listForApi: VideoMethods.ListForApi
  listOwnedAndPopulateAuthorAndTags: VideoMethods.ListOwnedAndPopulateAuthorAndTags
  listOwnedByAuthor: VideoMethods.ListOwnedByAuthor
  load: VideoMethods.Load
  loadAndPopulateAuthor: VideoMethods.LoadAndPopulateAuthor
  loadAndPopulateAuthorAndPodAndTags: VideoMethods.LoadAndPopulateAuthorAndPodAndTags
  loadByHostAndUUID: VideoMethods.LoadByHostAndUUID
  loadByUUID: VideoMethods.LoadByUUID
  loadLocalVideoByUUID: VideoMethods.LoadLocalVideoByUUID
  loadByUUIDAndPopulateAuthorAndPodAndTags: VideoMethods.LoadByUUIDAndPopulateAuthorAndPodAndTags
  searchAndPopulateAuthorAndPodAndTags: VideoMethods.SearchAndPopulateAuthorAndPodAndTags
}

export interface VideoAttributes {
  id?: number
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

  channelId?: number

  VideoChannel?: VideoChannelInstance
  Tags?: TagInstance[]
  VideoFiles?: VideoFileInstance[]
}

export interface VideoInstance extends VideoClass, VideoAttributes, Sequelize.Instance<VideoAttributes> {
  createdAt: Date
  updatedAt: Date

  createPreview: VideoMethods.CreatePreview
  createThumbnail: VideoMethods.CreateThumbnail
  createTorrentAndSetInfoHash: VideoMethods.CreateTorrentAndSetInfoHash
  getOriginalFile: VideoMethods.GetOriginalFile
  getPreviewName: VideoMethods.GetPreviewName
  getPreviewPath: VideoMethods.GetPreviewPath
  getThumbnailName: VideoMethods.GetThumbnailName
  getThumbnailPath: VideoMethods.GetThumbnailPath
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
  toFormattedDetailsJSON: VideoMethods.ToFormattedDetailsJSON
  toUpdateRemoteJSON: VideoMethods.ToUpdateRemoteJSON
  optimizeOriginalVideofile: VideoMethods.OptimizeOriginalVideofile
  transcodeOriginalVideofile: VideoMethods.TranscodeOriginalVideofile
  getOriginalFileHeight: VideoMethods.GetOriginalFileHeight
  getEmbedPath: VideoMethods.GetEmbedPath

  setTags: Sequelize.HasManySetAssociationsMixin<TagAttributes, string>
  addVideoFile: Sequelize.HasManyAddAssociationMixin<VideoFileAttributes, string>
  setVideoFiles: Sequelize.HasManySetAssociationsMixin<VideoFileAttributes, string>
}

export interface VideoModel extends VideoClass, Sequelize.Model<VideoInstance, VideoAttributes> {}
