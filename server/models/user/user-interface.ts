import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

// Don't use barrel, import just what we need
import { User as FormattedUser } from '../../../shared/models/users/user.model'
import { UserRole } from '../../../shared/models/users/user-role.type'
import { ResultList } from '../../../shared/models/result-list.model'
import { AuthorInstance } from '../video/author-interface'

export namespace UserMethods {
  export type IsPasswordMatch = (this: UserInstance, password: string) => Promise<boolean>

  export type ToFormattedJSON = (this: UserInstance) => FormattedUser
  export type IsAdmin = (this: UserInstance) => boolean
  export type IsAbleToUploadVideo = (this: UserInstance, videoFile: Express.Multer.File) => Promise<boolean>

  export type CountTotal = () => Promise<number>

  export type GetByUsername = (username: string) => Promise<UserInstance>

  export type ListForApi = (start: number, count: number, sort: string) => Promise< ResultList<UserInstance> >

  export type LoadById = (id: number) => Promise<UserInstance>

  export type LoadByUsername = (username: string) => Promise<UserInstance>
  export type LoadByUsernameAndPopulateChannels = (username: string) => Promise<UserInstance>

  export type LoadByUsernameOrEmail = (username: string, email: string) => Promise<UserInstance>
}

export interface UserClass {
  isPasswordMatch: UserMethods.IsPasswordMatch,
  toFormattedJSON: UserMethods.ToFormattedJSON,
  isAdmin: UserMethods.IsAdmin,
  isAbleToUploadVideo: UserMethods.IsAbleToUploadVideo,

  countTotal: UserMethods.CountTotal,
  getByUsername: UserMethods.GetByUsername,
  listForApi: UserMethods.ListForApi,
  loadById: UserMethods.LoadById,
  loadByUsername: UserMethods.LoadByUsername,
  loadByUsernameAndPopulateChannels: UserMethods.LoadByUsernameAndPopulateChannels,
  loadByUsernameOrEmail: UserMethods.LoadByUsernameOrEmail
}

export interface UserAttributes {
  id?: number
  password: string
  username: string
  email: string
  displayNSFW?: boolean
  role: UserRole
  videoQuota: number

  Author?: AuthorInstance
}

export interface UserInstance extends UserClass, UserAttributes, Sequelize.Instance<UserAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  isPasswordMatch: UserMethods.IsPasswordMatch
  toFormattedJSON: UserMethods.ToFormattedJSON
  isAdmin: UserMethods.IsAdmin
}

export interface UserModel extends UserClass, Sequelize.Model<UserInstance, UserAttributes> {}
