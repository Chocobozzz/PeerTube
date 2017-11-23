import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { SortType } from '../../helpers'
import { ResultList } from '../../../shared'
import { VideoInstance } from './video-interface'

// Don't use barrel, import just what we need
import { BlacklistedVideo as FormattedBlacklistedVideo } from '../../../shared/models/videos/video-blacklist.model'

export namespace BlacklistedVideoMethods {
  export type ToFormattedJSON = (this: BlacklistedVideoInstance) => FormattedBlacklistedVideo
  export type ListForApi = (start: number, count: number, sort: SortType) => Promise< ResultList<BlacklistedVideoInstance> >
  export type LoadByVideoId = (id: number) => Promise<BlacklistedVideoInstance>
}

export interface BlacklistedVideoClass {
  toFormattedJSON: BlacklistedVideoMethods.ToFormattedJSON
  listForApi: BlacklistedVideoMethods.ListForApi
  loadByVideoId: BlacklistedVideoMethods.LoadByVideoId
}

export interface BlacklistedVideoAttributes {
  videoId: number

  Video?: VideoInstance
}

export interface BlacklistedVideoInstance
  extends BlacklistedVideoClass, BlacklistedVideoAttributes, Sequelize.Instance<BlacklistedVideoAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  toFormattedJSON: BlacklistedVideoMethods.ToFormattedJSON
}

export interface BlacklistedVideoModel
  extends BlacklistedVideoClass, Sequelize.Model<BlacklistedVideoInstance, BlacklistedVideoAttributes> {}
