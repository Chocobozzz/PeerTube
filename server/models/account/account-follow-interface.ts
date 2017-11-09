import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { VideoRateType } from '../../../shared/models/videos/video-rate.type'

export namespace AccountFollowMethods {
}

export interface AccountFollowClass {
}

export interface AccountFollowAttributes {
  accountId: number
  targetAccountId: number
}

export interface AccountFollowInstance extends AccountFollowClass, AccountFollowAttributes, Sequelize.Instance<AccountFollowAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface AccountFollowModel extends AccountFollowClass, Sequelize.Model<AccountFollowInstance, AccountFollowAttributes> {}
