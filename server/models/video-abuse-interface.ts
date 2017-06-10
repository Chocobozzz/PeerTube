import * as Sequelize from 'sequelize'

// Don't use barrel, import just what we need
import { VideoAbuse as FormatedVideoAbuse } from '../../shared/models/video-abuse.model'

export namespace VideoAbuseMethods {
  export type toFormatedJSON = () => FormatedVideoAbuse

  export type ListForApiCallback = (err: Error, videoAbuseInstances?: VideoAbuseInstance[], total?: number) => void
  export type ListForApi = (start: number, count: number, sort: string, callback: ListForApiCallback) => void
}

export interface VideoAbuseClass {
  listForApi: VideoAbuseMethods.ListForApi
}

export interface VideoAbuseAttributes {
  reporterUsername: string
  reason: string
}

export interface VideoAbuseInstance extends VideoAbuseClass, VideoAbuseAttributes, Sequelize.Instance<VideoAbuseAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface VideoAbuseModel extends VideoAbuseClass, Sequelize.Model<VideoAbuseInstance, VideoAbuseAttributes> {}
