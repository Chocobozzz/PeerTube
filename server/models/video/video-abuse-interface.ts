import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { PodInstance } from '../pod'
import { ResultList } from '../../../shared'

// Don't use barrel, import just what we need
import { VideoAbuse as FormatedVideoAbuse } from '../../../shared/models/videos/video-abuse.model'

export namespace VideoAbuseMethods {
  export type ToFormatedJSON = (this: VideoAbuseInstance) => FormatedVideoAbuse

  export type ListForApi = (start: number, count: number, sort: string) => Promise< ResultList<VideoAbuseInstance> >
}

export interface VideoAbuseClass {
  listForApi: VideoAbuseMethods.ListForApi
}

export interface VideoAbuseAttributes {
  reporterUsername: string
  reason: string
  videoId: string
}

export interface VideoAbuseInstance extends VideoAbuseClass, VideoAbuseAttributes, Sequelize.Instance<VideoAbuseAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  Pod: PodInstance

  toFormatedJSON: VideoAbuseMethods.ToFormatedJSON
}

export interface VideoAbuseModel extends VideoAbuseClass, Sequelize.Model<VideoAbuseInstance, VideoAbuseAttributes> {}
