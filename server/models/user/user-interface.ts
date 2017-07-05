import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

// Don't use barrel, import just what we need
import { UserRole, User as FormatedUser } from '../../../shared/models/user.model'
import { ResultList } from '../../../shared/models/result-list.model'

export namespace UserMethods {
  export type IsPasswordMatch = (this: UserInstance, password: string) => Promise<boolean>

  export type ToFormatedJSON = (this: UserInstance) => FormatedUser
  export type IsAdmin = (this: UserInstance) => boolean

  export type CountTotal = () => Promise<number>

  export type GetByUsername = (username: string) => Promise<UserInstance>

  export type List = () => Promise<UserInstance[]>

  export type ListForApi = (start: number, count: number, sort: string) => Promise< ResultList<UserInstance> >

  export type LoadById = (id: number) => Promise<UserInstance>

  export type LoadByUsername = (username: string) => Promise<UserInstance>

  export type LoadByUsernameOrEmail = (username: string, email: string) => Promise<UserInstance>
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
