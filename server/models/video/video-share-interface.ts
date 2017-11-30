import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'
import { AccountInstance } from '../account/account-interface'
import { VideoInstance } from './video-interface'

export namespace VideoShareMethods {
  export type LoadAccountsByShare = (videoId: number, t: Sequelize.Transaction) => Bluebird<AccountInstance[]>
  export type Load = (accountId: number, videoId: number, t: Sequelize.Transaction) => Bluebird<VideoShareInstance>
}

export interface VideoShareClass {
  loadAccountsByShare: VideoShareMethods.LoadAccountsByShare
  load: VideoShareMethods.Load
}

export interface VideoShareAttributes {
  accountId: number
  videoId: number
}

export interface VideoShareInstance extends VideoShareClass, VideoShareAttributes, Sequelize.Instance<VideoShareAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  Account?: AccountInstance
  Video?: VideoInstance
}

export interface VideoShareModel extends VideoShareClass, Sequelize.Model<VideoShareInstance, VideoShareAttributes> {}
