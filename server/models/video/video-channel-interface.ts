import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { ResultList, RemoteVideoChannelCreateData, RemoteVideoChannelUpdateData } from '../../../shared'

// Don't use barrel, import just what we need
import { VideoChannel as FormattedVideoChannel } from '../../../shared/models/videos/video-channel.model'
import { AuthorInstance } from './author-interface'
import { VideoInstance } from './video-interface'

export namespace VideoChannelMethods {
  export type ToFormattedJSON = (this: VideoChannelInstance) => FormattedVideoChannel
  export type ToAddRemoteJSON = (this: VideoChannelInstance) => RemoteVideoChannelCreateData
  export type ToUpdateRemoteJSON = (this: VideoChannelInstance) => RemoteVideoChannelUpdateData
  export type IsOwned = (this: VideoChannelInstance) => boolean

  export type CountByAuthor = (authorId: number) => Promise<number>
  export type ListOwned = () => Promise<VideoChannelInstance[]>
  export type ListForApi = (start: number, count: number, sort: string) => Promise< ResultList<VideoChannelInstance> >
  export type LoadByIdAndAuthor = (id: number, authorId: number) => Promise<VideoChannelInstance>
  export type ListByAuthor = (authorId: number) => Promise< ResultList<VideoChannelInstance> >
  export type LoadAndPopulateAuthor = (id: number) => Promise<VideoChannelInstance>
  export type LoadByUUIDAndPopulateAuthor = (uuid: string) => Promise<VideoChannelInstance>
  export type LoadByUUID = (uuid: string, t?: Sequelize.Transaction) => Promise<VideoChannelInstance>
  export type LoadByHostAndUUID = (uuid: string, podHost: string, t?: Sequelize.Transaction) => Promise<VideoChannelInstance>
  export type LoadAndPopulateAuthorAndVideos = (id: number) => Promise<VideoChannelInstance>
}

export interface VideoChannelClass {
  countByAuthor: VideoChannelMethods.CountByAuthor
  listForApi: VideoChannelMethods.ListForApi
  listByAuthor: VideoChannelMethods.ListByAuthor
  listOwned: VideoChannelMethods.ListOwned
  loadByIdAndAuthor: VideoChannelMethods.LoadByIdAndAuthor
  loadByUUID: VideoChannelMethods.LoadByUUID
  loadByHostAndUUID: VideoChannelMethods.LoadByHostAndUUID
  loadAndPopulateAuthor: VideoChannelMethods.LoadAndPopulateAuthor
  loadByUUIDAndPopulateAuthor: VideoChannelMethods.LoadByUUIDAndPopulateAuthor
  loadAndPopulateAuthorAndVideos: VideoChannelMethods.LoadAndPopulateAuthorAndVideos
}

export interface VideoChannelAttributes {
  id?: number
  uuid?: string
  name: string
  description: string
  remote: boolean

  Author?: AuthorInstance
  Videos?: VideoInstance[]
}

export interface VideoChannelInstance extends VideoChannelClass, VideoChannelAttributes, Sequelize.Instance<VideoChannelAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  isOwned: VideoChannelMethods.IsOwned
  toFormattedJSON: VideoChannelMethods.ToFormattedJSON
  toAddRemoteJSON: VideoChannelMethods.ToAddRemoteJSON
  toUpdateRemoteJSON: VideoChannelMethods.ToUpdateRemoteJSON
}

export interface VideoChannelModel extends VideoChannelClass, Sequelize.Model<VideoChannelInstance, VideoChannelAttributes> {}
