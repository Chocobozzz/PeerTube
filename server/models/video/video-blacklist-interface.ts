import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { ResultList } from '../../../shared'

// Don't use barrel, import just what we need
import { BlacklistedVideo as FormattedBlacklistedVideo } from '../../../shared/models/videos/video-blacklist.model'

export namespace BlacklistedVideoMethods {
  export type ToFormattedJSON = (this: BlacklistedVideoInstance) => FormattedBlacklistedVideo

  export type CountTotal = () => Promise<number>

  export type List = () => Promise<BlacklistedVideoInstance[]>

  export type ListForApi = (start: number, count: number, sort: string) => Promise< ResultList<BlacklistedVideoInstance> >

  export type LoadById = (id: number) => Promise<BlacklistedVideoInstance>

  export type LoadByVideoId = (id: number) => Promise<BlacklistedVideoInstance>
}

export interface BlacklistedVideoClass {
  toFormattedJSON: BlacklistedVideoMethods.ToFormattedJSON
  countTotal: BlacklistedVideoMethods.CountTotal
  list: BlacklistedVideoMethods.List
  listForApi: BlacklistedVideoMethods.ListForApi
  loadById: BlacklistedVideoMethods.LoadById
  loadByVideoId: BlacklistedVideoMethods.LoadByVideoId
}

export interface BlacklistedVideoAttributes {
  videoId: number
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
