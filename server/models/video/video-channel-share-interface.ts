import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'
import { AccountInstance } from '../account/account-interface'
import { VideoChannelInstance } from './video-channel-interface'

export namespace VideoChannelShareMethods {
  export type LoadAccountsByShare = (videoChannelId: number, t: Sequelize.Transaction) => Bluebird<AccountInstance[]>
  export type Load = (accountId: number, videoId: number, t: Sequelize.Transaction) => Bluebird<VideoChannelShareInstance>
}

export interface VideoChannelShareClass {
  loadAccountsByShare: VideoChannelShareMethods.LoadAccountsByShare
  load: VideoChannelShareMethods.Load
}

export interface VideoChannelShareAttributes {
  accountId: number
  videoChannelId: number
}

export interface VideoChannelShareInstance
  extends VideoChannelShareClass, VideoChannelShareAttributes, Sequelize.Instance<VideoChannelShareAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  Account?: AccountInstance
  VideoChannel?: VideoChannelInstance
}

export interface VideoChannelShareModel
  extends VideoChannelShareClass, Sequelize.Model<VideoChannelShareInstance, VideoChannelShareAttributes> {}
