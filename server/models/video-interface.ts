import * as Sequelize from 'sequelize'

export namespace VideoMethods {
  export type GenerateMagnetUri = () => void
  export type GetVideoFilename = () => void
  export type GetThumbnailName = () => void
  export type GetPreviewName = () => void
  export type GetTorrentName = () => void
  export type IsOwned = () => void
  export type ToFormatedJSON = () => void
  export type ToAddRemoteJSON = (callback) => void
  export type ToUpdateRemoteJSON = (callback) => void
  export type TranscodeVideofile = (callback) => void

  export type GenerateThumbnailFromData = (video, thumbnailData, callback) => void
  export type GetDurationFromFile = (videoPath, callback) => void
  export type List = (callback) => void
  export type ListForApi = (start, count, sort, callback) => void
  export type LoadByHostAndRemoteId = (fromHost, remoteId, callback) => void
  export type ListOwnedAndPopulateAuthorAndTags = (callback) => void
  export type ListOwnedByAuthor = (author, callback) => void
  export type Load = (id, callback) => void
  export type LoadAndPopulateAuthor = (id, callback) => void
  export type LoadAndPopulateAuthorAndPodAndTags = (id, callback) => void
  export type SearchAndPopulateAuthorAndPodAndTags = (value, field, start, count, sort, callback) => void
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
}

export interface VideoInstance extends VideoClass, VideoAttributes, Sequelize.Instance<VideoAttributes> {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface VideoModel extends VideoClass, Sequelize.Model<VideoInstance, VideoAttributes> {}
