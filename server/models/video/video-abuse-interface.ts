import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { ServerInstance } from '../server/server-interface'
import { ResultList } from '../../../shared'

// Don't use barrel, import just what we need
import { VideoAbuse as FormattedVideoAbuse } from '../../../shared/models/videos/video-abuse.model'

export namespace VideoAbuseMethods {
  export type ToFormattedJSON = (this: VideoAbuseInstance) => FormattedVideoAbuse

  export type ListForApi = (start: number, count: number, sort: string) => Promise< ResultList<VideoAbuseInstance> >
}

export interface VideoAbuseClass {
  listForApi: VideoAbuseMethods.ListForApi
}

export interface VideoAbuseAttributes {
  reporterUsername: string
  reason: string
  videoId: number
}

export interface VideoAbuseInstance extends VideoAbuseClass, VideoAbuseAttributes, Sequelize.Instance<VideoAbuseAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  Server: ServerInstance

  toFormattedJSON: VideoAbuseMethods.ToFormattedJSON
}

export interface VideoAbuseModel extends VideoAbuseClass, Sequelize.Model<VideoAbuseInstance, VideoAbuseAttributes> {}
