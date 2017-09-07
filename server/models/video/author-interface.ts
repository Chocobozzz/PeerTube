import * as Sequelize from 'sequelize'
import * as Promise from 'bluebird'

import { PodInstance } from '../pod/pod-interface'

export namespace AuthorMethods {
  export type FindOrCreateAuthor = (
    name: string,
    podId: number,
    userId: number,
    transaction: Sequelize.Transaction
  ) => Promise<AuthorInstance>
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
