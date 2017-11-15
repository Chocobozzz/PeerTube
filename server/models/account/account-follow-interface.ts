import * as Sequelize from 'sequelize'
import * as Bluebird from 'bluebird'
import { FollowState } from '../../../shared/models/accounts/follow.model'
import { ResultList } from '../../../shared/models/result-list.model'
import { AccountInstance } from './account-interface'

export namespace AccountFollowMethods {
  export type LoadByAccountAndTarget = (accountId: number, targetAccountId: number) => Bluebird<AccountFollowInstance>

  export type ListFollowingForApi = (id: number, start: number, count: number, sort: string) => Bluebird< ResultList<AccountInstance> >
  export type ListFollowersForApi = (id: number, start: number, count: number, sort: string) => Bluebird< ResultList<AccountInstance> >

  export type ListAcceptedFollowerUrlsForApi = (id: number, start?: number, count?: number) => Promise< ResultList<string> >
  export type ListAcceptedFollowingUrlsForApi = (id: number, start?: number, count?: number) => Promise< ResultList<string> >
}

export interface AccountFollowClass {
  loadByAccountAndTarget: AccountFollowMethods.LoadByAccountAndTarget
  listFollowersForApi: AccountFollowMethods.ListFollowersForApi
  listFollowingForApi: AccountFollowMethods.ListFollowingForApi

  listAcceptedFollowerUrlsForApi: AccountFollowMethods.ListAcceptedFollowerUrlsForApi
  listAcceptedFollowingUrlsForApi: AccountFollowMethods.ListAcceptedFollowingUrlsForApi
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
}

export interface AccountFollowModel extends AccountFollowClass, Sequelize.Model<AccountFollowInstance, AccountFollowAttributes> {}
