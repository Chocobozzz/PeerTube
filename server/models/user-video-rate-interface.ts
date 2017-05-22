import * as Sequelize from 'sequelize'

export namespace UserVideoRateMethods {
  export type Load = (userId, videoId, transaction, callback) => void
}

export interface UserVideoRateClass {
  load: UserVideoRateMethods.Load
}

export interface UserVideoRateAttributes {
  type: string
}

export interface UserVideoRateInstance extends Sequelize.Instance<UserVideoRateAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface UserVideoRateModel extends UserVideoRateClass, Sequelize.Model<UserVideoRateInstance, UserVideoRateAttributes> {}
