import * as Sequelize from 'sequelize'
import * as Bluebird from 'bluebird'
import { FollowState } from '../../../shared/models/accounts/follow.model'

export namespace AccountFollowMethods {
  export type LoadByAccountAndTarget = (accountId: number, targetAccountId: number) => Bluebird<AccountFollowInstance>
}

export interface AccountFollowClass {
  loadByAccountAndTarget: AccountFollowMethods.LoadByAccountAndTarget
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
}

export interface AccountFollowModel extends AccountFollowClass, Sequelize.Model<AccountFollowInstance, AccountFollowAttributes> {}
