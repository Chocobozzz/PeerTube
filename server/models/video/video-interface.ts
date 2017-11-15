import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'
import { VideoTorrentObject } from '../../../shared/models/activitypub/objects/video-torrent-object'
import { ResultList } from '../../../shared/models/result-list.model'
import { Video as FormattedVideo, VideoDetails as FormattedDetailsVideo } from '../../../shared/models/videos/video.model'

import { TagAttributes, TagInstance } from './tag-interface'
import { VideoChannelInstance } from './video-channel-interface'
import { VideoFileAttributes, VideoFileInstance } from './video-file-interface'

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

  export type ToActivityPubObject = (this: VideoInstance) => VideoTorrentObject

  export type OptimizeOriginalVideofile = (this: VideoInstance) => Promise<void>
  export type TranscodeOriginalVideofile = (this: VideoInstance, resolution: number) => Promise<void>
  export type GetOriginalFileHeight = (this: VideoInstance) => Promise<number>
  export type GetEmbedPath = (this: VideoInstance) => string
  export type GetThumbnailPath = (this: VideoInstance) => string
  export type GetPreviewPath = (this: VideoInstance) => string
  export type GetDescriptionPath = (this: VideoInstance) => string
  export type GetTruncatedDescription = (this: VideoInstance) => string
  export type GetCategoryLabel = (this: VideoInstance) => string
  export type GetLicenceLabel = (this: VideoInstance) => string
  export type GetLanguageLabel = (this: VideoInstance) => string

  // Return thumbnail name
  export type GenerateThumbnailFromData = (video: VideoInstance, thumbnailData: string) => Promise<string>

  export type List = () => Bluebird<VideoInstance[]>
  export type ListOwnedAndPopulateAccountAndTags = () => Bluebird<VideoInstance[]>
  export type ListOwnedByAccount = (account: string) => Bluebird<VideoInstance[]>

  export type ListForApi = (start: number, count: number, sort: string) => Bluebird< ResultList<VideoInstance> >
  export type ListUserVideosForApi = (userId: number, start: number, count: number, sort: string) => Bluebird< ResultList<VideoInstance> >
  export type SearchAndPopulateAccountAndServerAndTags = (
    value: string,
    field: string,
    start: number,
    count: number,
    sort: string
  ) => Bluebird< ResultList<VideoInstance> >

  export type Load = (id: number) => Bluebird<VideoInstance>
  export type LoadByUUID = (uuid: string, t?: Sequelize.Transaction) => Bluebird<VideoInstance>
  export type LoadByUrl = (url: string, t?: Sequelize.Transaction) => Bluebird<VideoInstance>
  export type LoadLocalVideoByUUID = (uuid: string, t?: Sequelize.Transaction) => Bluebird<VideoInstance>
  export type LoadByHostAndUUID = (fromHost: string, uuid: string, t?: Sequelize.Transaction) => Bluebird<VideoInstance>
  export type LoadAndPopulateAccount = (id: number) => Bluebird<VideoInstance>
  export type LoadAndPopulateAccountAndServerAndTags = (id: number) => Bluebird<VideoInstance>
  export type LoadByUUIDAndPopulateAccountAndServerAndTags = (uuid: string) => Bluebird<VideoInstance>
  export type LoadByUUIDOrURL = (uuid: string, url: string, t?: Sequelize.Transaction) => Bluebird<VideoInstance>

  export type RemoveThumbnail = (this: VideoInstance) => Promise<void>
  export type RemovePreview = (this: VideoInstance) => Promise<void>
  export type RemoveFile = (this: VideoInstance, videoFile: VideoFileInstance) => Promise<void>
  export type RemoveTorrent = (this: VideoInstance, videoFile: VideoFileInstance) => Promise<void>
}

export interface VideoClass {
  generateThumbnailFromData: VideoMethods.GenerateThumbnailFromData
  list: VideoMethods.List
  listForApi: VideoMethods.ListForApi
  listUserVideosForApi: VideoMethods.ListUserVideosForApi
  listOwnedAndPopulateAccountAndTags: VideoMethods.ListOwnedAndPopulateAccountAndTags
  listOwnedByAccount: VideoMethods.ListOwnedByAccount
  load: VideoMethods.Load
  loadAndPopulateAccount: VideoMethods.LoadAndPopulateAccount
  loadAndPopulateAccountAndServerAndTags: VideoMethods.LoadAndPopulateAccountAndServerAndTags
  loadByHostAndUUID: VideoMethods.LoadByHostAndUUID
  loadByUUID: VideoMethods.LoadByUUID
  loadByUrl: VideoMethods.LoadByUrl
  loadByUUIDOrURL: VideoMethods.LoadByUUIDOrURL
  loadLocalVideoByUUID: VideoMethods.LoadLocalVideoByUUID
  loadByUUIDAndPopulateAccountAndServerAndTags: VideoMethods.LoadByUUIDAndPopulateAccountAndServerAndTags
  searchAndPopulateAccountAndServerAndTags: VideoMethods.SearchAndPopulateAccountAndServerAndTags
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
  privacy: number
  views?: number
  likes?: number
  dislikes?: number
  remote: boolean
  url?: string

  createdAt?: Date
  updatedAt?: Date

  parentId?: number
  channelId?: number

  VideoChannel?: VideoChannelInstance
  Tags?: TagInstance[]
  VideoFiles?: VideoFileInstance[]
}

export interface VideoInstance extends VideoClass, VideoAttributes, Sequelize.Instance<VideoAttributes> {
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
  toActivityPubObject: VideoMethods.ToActivityPubObject
  toFormattedJSON: VideoMethods.ToFormattedJSON
  toFormattedDetailsJSON: VideoMethods.ToFormattedDetailsJSON
  optimizeOriginalVideofile: VideoMethods.OptimizeOriginalVideofile
  transcodeOriginalVideofile: VideoMethods.TranscodeOriginalVideofile
  getOriginalFileHeight: VideoMethods.GetOriginalFileHeight
  getEmbedPath: VideoMethods.GetEmbedPath
  getDescriptionPath: VideoMethods.GetDescriptionPath
  getTruncatedDescription: VideoMethods.GetTruncatedDescription
  getCategoryLabel: VideoMethods.GetCategoryLabel
  getLicenceLabel: VideoMethods.GetLicenceLabel
  getLanguageLabel: VideoMethods.GetLanguageLabel

  setTags: Sequelize.HasManySetAssociationsMixin<TagAttributes, string>
  addVideoFile: Sequelize.HasManyAddAssociationMixin<VideoFileAttributes, string>
  setVideoFiles: Sequelize.HasManySetAssociationsMixin<VideoFileAttributes, string>
}

export interface VideoModel extends VideoClass, Sequelize.Model<VideoInstance, VideoAttributes> {}
