import * as Sequelize from 'sequelize'

export namespace BlacklistedVideoMethods {
  export type ToFormatedJSON = () => void

  export type CountTotal = (callback) => void
  export type List = (callback) => void
  export type ListForApi = (start, count, sort, callback) => void
  export type LoadById = (id, callback) => void
  export type LoadByVideoId = (id, callback) => void
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
}

export interface BlacklistedVideoInstance extends BlacklistedVideoClass, BlacklistedVideoAttributes, Sequelize.Instance<BlacklistedVideoAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface BlacklistedVideoModel extends BlacklistedVideoClass, Sequelize.Model<BlacklistedVideoInstance, BlacklistedVideoAttributes> {}
