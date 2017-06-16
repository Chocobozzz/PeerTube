import * as Sequelize from 'sequelize'

export namespace UserVideoRateMethods {
  export type LoadCallback = (err: Error, userVideoRateInstance: UserVideoRateInstance) => void
  export type Load = (userId, videoId, transaction, callback) => void
}

export interface UserVideoRateClass {
  load: UserVideoRateMethods.Load
}

export interface UserVideoRateAttributes {
  type: string
}

export interface UserVideoRateInstance extends UserVideoRateClass, UserVideoRateAttributes, Sequelize.Instance<UserVideoRateAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface UserVideoRateModel extends UserVideoRateClass, Sequelize.Model<UserVideoRateInstance, UserVideoRateAttributes> {}
