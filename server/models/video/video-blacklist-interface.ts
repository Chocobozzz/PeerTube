import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { ResultList } from '../../../shared'

// Don't use barrel, import just what we need
import { BlacklistedVideo as FormatedBlacklistedVideo } from '../../../shared/models/videos/video-blacklist.model'

export namespace BlacklistedVideoMethods {
  export type ToFormatedJSON = (this: BlacklistedVideoInstance) => FormatedBlacklistedVideo

  export type CountTotal = () => Promise<number>

  export type List = () => Promise<BlacklistedVideoInstance[]>

  export type ListForApi = (start: number, count: number, sort: string) => Promise< ResultList<BlacklistedVideoInstance> >

  export type LoadById = (id: number) => Promise<BlacklistedVideoInstance>

  export type LoadByVideoId = (id: string) => Promise<BlacklistedVideoInstance>
}

export interface BlacklistedVideoClass {
  toFormatedJSON: BlacklistedVideoMethods.ToFormatedJSON
  countTotal: BlacklistedVideoMethods.CountTotal
  list: BlacklistedVideoMethods.List
  listForApi: BlacklistedVideoMethods.ListForApi
  loadById: BlacklistedVideoMethods.LoadById
  loadByVideoId: BlacklistedVideoMethods.LoadByVideoId
}

export interface BlacklistedVideoAttributes {
  videoId: string
}

export interface BlacklistedVideoInstance
  extends BlacklistedVideoClass, BlacklistedVideoAttributes, Sequelize.Instance<BlacklistedVideoAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  toFormatedJSON: BlacklistedVideoMethods.ToFormatedJSON
}

export interface BlacklistedVideoModel
  extends BlacklistedVideoClass, Sequelize.Model<BlacklistedVideoInstance, BlacklistedVideoAttributes> {}
