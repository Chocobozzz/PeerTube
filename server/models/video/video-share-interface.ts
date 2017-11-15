import * as Sequelize from 'sequelize'
import { AccountInstance } from '../account/account-interface'
import { VideoInstance } from './video-interface'

export namespace VideoShareMethods {
}

export interface VideoShareClass {
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
