import * as Sequelize from 'sequelize'

export namespace VideoTagMethods {
}

export interface VideoTagClass {
}

export interface VideoTagAttributes {
}

export interface VideoTagInstance extends Sequelize.Instance<VideoTagAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface VideoTagModel extends VideoTagClass, Sequelize.Model<VideoTagInstance, VideoTagAttributes> {}
