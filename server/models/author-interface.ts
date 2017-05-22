import * as Sequelize from 'sequelize'

export namespace AuthorMethods {
  export type FindOrCreateAuthor = (name, podId, userId, transaction, callback) => void
}

export interface AuthorClass {
  findOrCreateAuthor: AuthorMethods.FindOrCreateAuthor
}

export interface AuthorAttributes {
  name: string
}

export interface AuthorInstance extends AuthorClass, AuthorAttributes, Sequelize.Instance<AuthorAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date
}

export interface AuthorModel extends AuthorClass, Sequelize.Model<AuthorInstance, AuthorAttributes> {}
