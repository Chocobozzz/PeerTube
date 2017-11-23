import * as Sequelize from 'sequelize'
import * as Bluebird from 'bluebird'

// Don't use barrel, import just what we need
import { AccountInstance } from './account-interface'
import { User as FormattedUser } from '../../../shared/models/users/user.model'
import { ResultList } from '../../../shared/models/result-list.model'
import { UserRight } from '../../../shared/models/users/user-right.enum'
import { UserRole } from '../../../shared/models/users/user-role'

export namespace UserMethods {
  export type HasRight = (this: UserInstance, right: UserRight) => boolean
  export type IsPasswordMatch = (this: UserInstance, password: string) => Promise<boolean>

  export type ToFormattedJSON = (this: UserInstance) => FormattedUser
  export type IsAbleToUploadVideo = (this: UserInstance, videoFile: Express.Multer.File) => Promise<boolean>

  export type CountTotal = () => Bluebird<number>

  export type GetByUsername = (username: string) => Bluebird<UserInstance>

  export type ListForApi = (start: number, count: number, sort: string) => Bluebird< ResultList<UserInstance> >

  export type LoadById = (id: number) => Bluebird<UserInstance>

  export type LoadByUsername = (username: string) => Bluebird<UserInstance>
  export type LoadByUsernameAndPopulateChannels = (username: string) => Bluebird<UserInstance>

  export type LoadByUsernameOrEmail = (username: string, email: string) => Bluebird<UserInstance>
}

export interface UserClass {
  isPasswordMatch: UserMethods.IsPasswordMatch,
  toFormattedJSON: UserMethods.ToFormattedJSON,
  hasRight: UserMethods.HasRight,
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

  Account?: AccountInstance
}

export interface UserInstance extends UserClass, UserAttributes, Sequelize.Instance<UserAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  isPasswordMatch: UserMethods.IsPasswordMatch
  toFormattedJSON: UserMethods.ToFormattedJSON
  hasRight: UserMethods.HasRight
}

export interface UserModel extends UserClass, Sequelize.Model<UserInstance, UserAttributes> {}
