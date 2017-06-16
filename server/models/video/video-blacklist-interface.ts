import * as Sequelize from 'sequelize'

// Don't use barrel, import just what we need
import { BlacklistedVideo as FormatedBlacklistedVideo } from '../../../shared/models/video-blacklist.model'

export namespace BlacklistedVideoMethods {
  export type ToFormatedJSON = (this: BlacklistedVideoInstance) => FormatedBlacklistedVideo

  export type CountTotalCallback = (err: Error, total: number) => void
  export type CountTotal = (callback: CountTotalCallback) => void

  export type ListCallback = (err: Error, backlistedVideoInstances: BlacklistedVideoInstance[]) => void
  export type List = (callback: ListCallback) => void

  export type ListForApiCallback = (err: Error, blacklistedVIdeoInstances?: BlacklistedVideoInstance[], total?: number) => void
  export type ListForApi = (start: number, count: number, sort: string, callback: ListForApiCallback) => void

  export type LoadByIdCallback = (err: Error, blacklistedVideoInstance: BlacklistedVideoInstance) => void
  export type LoadById = (id: number, callback: LoadByIdCallback) => void

  export type LoadByVideoIdCallback = (err: Error, blacklistedVideoInstance: BlacklistedVideoInstance) => void
  export type LoadByVideoId = (id: string, callback: LoadByVideoIdCallback) => void
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

export interface BlacklistedVideoInstance extends BlacklistedVideoClass, BlacklistedVideoAttributes, Sequelize.Instance<BlacklistedVideoAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface BlacklistedVideoModel extends BlacklistedVideoClass, Sequelize.Model<BlacklistedVideoInstance, BlacklistedVideoAttributes> {}
