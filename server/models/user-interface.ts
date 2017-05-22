import * as Sequelize from 'sequelize'

export namespace UserMethods {
  export type IsPasswordMatch = (password, callback) => void
  export type ToFormatedJSON = () => void
  export type IsAdmin = () => boolean

  export type CountTotal = (callback) => void
  export type GetByUsername = (username) => any
  export type List = (callback) => void
  export type ListForApi = (start, count, sort, callback) => void
  export type LoadById = (id, callback) => void
  export type LoadByUsername = (username, callback) => void
  export type LoadByUsernameOrEmail = (username, email, callback) => void
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
  role: string
}

export interface UserInstance extends UserClass, UserAttributes, Sequelize.Instance<UserAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface UserModel extends UserClass, Sequelize.Model<UserInstance, UserAttributes> {}
