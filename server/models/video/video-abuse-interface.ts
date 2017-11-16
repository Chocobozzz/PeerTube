import * as Promise from 'bluebird'
import * as Sequelize from 'sequelize'
import { ResultList } from '../../../shared'
import { VideoAbuse as FormattedVideoAbuse } from '../../../shared/models/videos/video-abuse.model'
import { AccountInstance } from '../account/account-interface'
import { ServerInstance } from '../server/server-interface'
import { VideoInstance } from './video-interface'
import { VideoAbuseObject } from '../../../shared/models/activitypub/objects/video-abuse-object'

export namespace VideoAbuseMethods {
  export type ToFormattedJSON = (this: VideoAbuseInstance) => FormattedVideoAbuse

  export type ListForApi = (start: number, count: number, sort: string) => Promise< ResultList<VideoAbuseInstance> >
  export type ToActivityPubObject = () => VideoAbuseObject
}

export interface VideoAbuseClass {
  listForApi: VideoAbuseMethods.ListForApi
  toActivityPubObject: VideoAbuseMethods.ToActivityPubObject
}

export interface VideoAbuseAttributes {
  reason: string
  videoId: number
  reporterAccountId: number

  Account?: AccountInstance
  Video?: VideoInstance
}

export interface VideoAbuseInstance extends VideoAbuseClass, VideoAbuseAttributes, Sequelize.Instance<VideoAbuseAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  Server: ServerInstance

  toFormattedJSON: VideoAbuseMethods.ToFormattedJSON
}

export interface VideoAbuseModel extends VideoAbuseClass, Sequelize.Model<VideoAbuseInstance, VideoAbuseAttributes> {}
