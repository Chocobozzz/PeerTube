import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'
import { AccountFollow, FollowState } from '../../../shared/models/accounts/follow.model'
import { ResultList } from '../../../shared/models/result-list.model'
import { AccountInstance } from './account-interface'

export namespace AccountFollowMethods {
  export type LoadByAccountAndTarget = (
    accountId: number,
    targetAccountId: number,
    t?: Sequelize.Transaction
  ) => Bluebird<AccountFollowInstance>

  export type ListFollowingForApi = (id: number, start: number, count: number, sort: string) => Bluebird< ResultList<AccountFollowInstance>>
  export type ListFollowersForApi = (id: number, start: number, count: number, sort: string) => Bluebird< ResultList<AccountFollowInstance>>

  export type ListAcceptedFollowerUrlsForApi = (
    accountId: number[],
    t: Sequelize.Transaction,
    start?: number,
    count?: number
  ) => Promise< ResultList<string> >
  export type ListAcceptedFollowingUrlsForApi = (
    accountId: number[],
    t: Sequelize.Transaction,
    start?: number,
    count?: number
  ) => Promise< ResultList<string> >
  export type ListAcceptedFollowerSharedInboxUrls = (accountId: number[], t: Sequelize.Transaction) => Promise< ResultList<string> >
  export type ToFormattedJSON = (this: AccountFollowInstance) => AccountFollow
}

export interface AccountFollowClass {
  loadByAccountAndTarget: AccountFollowMethods.LoadByAccountAndTarget
  listFollowersForApi: AccountFollowMethods.ListFollowersForApi
  listFollowingForApi: AccountFollowMethods.ListFollowingForApi

  listAcceptedFollowerUrlsForApi: AccountFollowMethods.ListAcceptedFollowerUrlsForApi
  listAcceptedFollowingUrlsForApi: AccountFollowMethods.ListAcceptedFollowingUrlsForApi
  listAcceptedFollowerSharedInboxUrls: AccountFollowMethods.ListAcceptedFollowerSharedInboxUrls
}

export interface AccountFollowAttributes {
  accountId: number
  targetAccountId: number
  state: FollowState
}

export interface AccountFollowInstance extends AccountFollowClass, AccountFollowAttributes, Sequelize.Instance<AccountFollowAttributes> {
  id: number
  createdAt: Date
  updatedAt: Date

  AccountFollower?: AccountInstance
  AccountFollowing?: AccountInstance

  toFormattedJSON: AccountFollowMethods.ToFormattedJSON
}

export interface AccountFollowModel extends AccountFollowClass, Sequelize.Model<AccountFollowInstance, AccountFollowAttributes> {}
