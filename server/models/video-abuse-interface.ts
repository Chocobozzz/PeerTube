import * as Sequelize from 'sequelize'

export namespace VideoAbuseMethods {
  export type toFormatedJSON = () => void

  export type ListForApi = (start, count, sort, callback) => void
}

export interface VideoAbuseClass {
  listForApi: VideoAbuseMethods.ListForApi
}

export interface VideoAbuseAttributes {
  reporterUsername: string
  reason: string
}

export interface VideoAbuseInstance extends Sequelize.Instance<VideoAbuseAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface VideoAbuseModel extends VideoAbuseClass, Sequelize.Model<VideoAbuseInstance, VideoAbuseAttributes> {}
