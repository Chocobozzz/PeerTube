import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { PodInstance } from '../pod/pod-interface'
import { RemoteVideoAuthorCreateData } from '../../../shared/models/pods/remote-video/remote-video-author-create-request.model'
import { VideoChannelInstance } from './video-channel-interface'

export namespace AuthorMethods {
  export type Load = (id: number) => Promise<AuthorInstance>
  export type LoadByUUID = (uuid: string) => Promise<AuthorInstance>
  export type LoadAuthorByPodAndUUID = (uuid: string, podId: number, transaction: Sequelize.Transaction) => Promise<AuthorInstance>
  export type ListOwned = () => Promise<AuthorInstance[]>

  export type ToAddRemoteJSON = (this: AuthorInstance) => RemoteVideoAuthorCreateData
  export type IsOwned = (this: AuthorInstance) => boolean
}

export interface AuthorClass {
  loadAuthorByPodAndUUID: AuthorMethods.LoadAuthorByPodAndUUID
  load: AuthorMethods.Load
  loadByUUID: AuthorMethods.LoadByUUID
  listOwned: AuthorMethods.ListOwned
}

export interface AuthorAttributes {
  name: string
  uuid?: string

  podId?: number
  userId?: number
}

export interface AuthorInstance extends AuthorClass, AuthorAttributes, Sequelize.Instance<AuthorAttributes> {
  isOwned: AuthorMethods.IsOwned
  toAddRemoteJSON: AuthorMethods.ToAddRemoteJSON

  id: number
  createdAt: Date
  updatedAt: Date

  Pod: PodInstance
  VideoChannels: VideoChannelInstance[]
}

export interface AuthorModel extends AuthorClass, Sequelize.Model<AuthorInstance, AuthorAttributes> {}
