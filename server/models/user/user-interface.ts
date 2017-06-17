import * as Sequelize from 'sequelize'
import * as Bluebird from 'bluebird'

// Don't use barrel, import just what we need
import { UserRole, User as FormatedUser } from '../../../shared/models/user.model'

export namespace UserMethods {
  export type IsPasswordMatchCallback = (err: Error, same: boolean) => void
  export type IsPasswordMatch = (this: UserInstance, password: string, callback: IsPasswordMatchCallback) => void

  export type ToFormatedJSON = (this: UserInstance) => FormatedUser
  export type IsAdmin = (this: UserInstance) => boolean

  export type CountTotalCallback = (err: Error, total: number) => void
  export type CountTotal = (callback: CountTotalCallback) => void

  export type GetByUsername = (username: string) => Bluebird<UserInstance>

  export type ListCallback = (err: Error, userInstances: UserInstance[]) => void
  export type List = (callback: ListCallback) => void

  export type ListForApiCallback = (err: Error, userInstances?: UserInstance[], total?: number) => void
  export type ListForApi = (start: number, count: number, sort: string, callback: ListForApiCallback) => void

  export type LoadByIdCallback = (err: Error, userInstance: UserInstance) => void
  export type LoadById = (id: number, callback: LoadByIdCallback) => void

  export type LoadByUsernameCallback = (err: Error, userInstance: UserInstance) => void
  export type LoadByUsername = (username: string, callback: LoadByUsernameCallback) => void

  export type LoadByUsernameOrEmailCallback = (err: Error, userInstance: UserInstance) => void
  export type LoadByUsernameOrEmail = (username: string, email: string, callback: LoadByUsernameOrEmailCallback) => void
}

export interface UserClass {
  isPasswordMatch: UserMethods.IsPasswordMatch,
  toFormatedJSON: UserMethods.ToFormatedJSON,
  isAdmin: UserMethods.IsAdmin,

  countTotal: UserMethods.CountTotal,
  getByUsername: UserMethods.GetByUsername,
  list: UserMethods.List,
  listForApi: UserMethods.ListForApi,
  loadById: UserMethods.LoadById,
  loadByUsername: UserMethods.LoadByUsername,
  loadByUsernameOrEmail: UserMethods.LoadByUsernameOrEmail
}

export interface UserAttributes {
  password: string
  username: string
  email: string
  displayNSFW?: boolean
  role: UserRole
}

export interface UserInstance extends UserClass, UserAttributes, Sequelize.Instance<UserAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  isPasswordMatch: UserMethods.IsPasswordMatch
  toFormatedJSON: UserMethods.ToFormatedJSON
  isAdmin: UserMethods.IsAdmin
}

export interface UserModel extends UserClass, Sequelize.Model<UserInstance, UserAttributes> {}
