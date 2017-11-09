import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { VideoRateType } from '../../../shared/models/videos/video-rate.type'

export namespace AccountVideoRateMethods {
  export type Load = (accountId: number, videoId: number, transaction: Sequelize.Transaction) => Promise<AccountVideoRateInstance>
}

export interface AccountVideoRateClass {
  load: AccountVideoRateMethods.Load
}

export interface AccountVideoRateAttributes {
  type: VideoRateType
  accountId: number
  videoId: number
}

export interface AccountVideoRateInstance extends AccountVideoRateClass, AccountVideoRateAttributes, Sequelize.Instance<AccountVideoRateAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface AccountVideoRateModel extends AccountVideoRateClass, Sequelize.Model<AccountVideoRateInstance, AccountVideoRateAttributes> {}
