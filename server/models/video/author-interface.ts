import * as Sequelize from 'sequelize'

import { PodInstance } from '../pod'

export namespace AuthorMethods {
  export type FindOrCreateAuthorCallback = (err: Error, authorInstance?: AuthorInstance) => void
  export type FindOrCreateAuthor = (name: string, podId: number, userId: number, transaction: Sequelize.Transaction, callback: FindOrCreateAuthorCallback) => void
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

  podId: number
  Pod: PodInstance
}

export interface AuthorModel extends AuthorClass, Sequelize.Model<AuthorInstance, AuthorAttributes> {}
