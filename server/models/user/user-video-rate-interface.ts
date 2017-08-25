import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { VideoRateType } from '../../../shared/models/videos/video-rate.type'

export namespace UserVideoRateMethods {
  export type Load = (userId: number, videoId: number, transaction: Sequelize.Transaction) => Promise<UserVideoRateInstance>
}

export interface UserVideoRateClass {
  load: UserVideoRateMethods.Load
}

export interface UserVideoRateAttributes {
  type: VideoRateType
  userId: number
  videoId: number
}

export interface UserVideoRateInstance extends UserVideoRateClass, UserVideoRateAttributes, Sequelize.Instance<UserVideoRateAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface UserVideoRateModel extends UserVideoRateClass, Sequelize.Model<UserVideoRateInstance, UserVideoRateAttributes> {}
