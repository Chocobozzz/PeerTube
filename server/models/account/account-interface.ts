import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'
import { Account as FormattedAccount, ActivityPubActor } from '../../../shared'
import { ServerInstance } from '../server/server-interface'
import { VideoChannelInstance } from '../video/video-channel-interface'

export namespace AccountMethods {
  export type LoadApplication = () => Bluebird<AccountInstance>

  export type Load = (id: number) => Bluebird<AccountInstance>
  export type LoadByUUID = (uuid: string) => Bluebird<AccountInstance>
  export type LoadByUrl = (url: string, transaction?: Sequelize.Transaction) => Bluebird<AccountInstance>
  export type LoadLocalByName = (name: string) => Bluebird<AccountInstance>
  export type LoadByNameAndHost = (name: string, host: string) => Bluebird<AccountInstance>

  export type ToActivityPubObject = (this: AccountInstance) => ActivityPubActor
  export type ToFormattedJSON = (this: AccountInstance) => FormattedAccount
  export type IsOwned = (this: AccountInstance) => boolean
  export type GetFollowerSharedInboxUrls = (this: AccountInstance) => Bluebird<string[]>
  export type GetFollowingUrl = (this: AccountInstance) => string
  export type GetFollowersUrl = (this: AccountInstance) => string
  export type GetPublicKeyUrl = (this: AccountInstance) => string
}

export interface AccountClass {
  loadApplication: AccountMethods.LoadApplication
  load: AccountMethods.Load
  loadByUUID: AccountMethods.LoadByUUID
  loadByUrl: AccountMethods.LoadByUrl
  loadLocalByName: AccountMethods.LoadLocalByName
  loadByNameAndHost: AccountMethods.LoadByNameAndHost
}

export interface AccountAttributes {
  name: string
  url?: string
  publicKey: string
  privateKey: string
  followersCount: number
  followingCount: number
  inboxUrl: string
  outboxUrl: string
  sharedInboxUrl: string
  followersUrl: string
  followingUrl: string

  uuid?: string

  serverId?: number
  userId?: number
  applicationId?: number
}

export interface AccountInstance extends AccountClass, AccountAttributes, Sequelize.Instance<AccountAttributes> {
  isOwned: AccountMethods.IsOwned
  toActivityPubObject: AccountMethods.ToActivityPubObject
  toFormattedJSON: AccountMethods.ToFormattedJSON
  getFollowerSharedInboxUrls: AccountMethods.GetFollowerSharedInboxUrls
  getFollowingUrl: AccountMethods.GetFollowingUrl
  getFollowersUrl: AccountMethods.GetFollowersUrl
  getPublicKeyUrl: AccountMethods.GetPublicKeyUrl

  id: number
  createdAt: Date
  updatedAt: Date

  Server: ServerInstance
  VideoChannels: VideoChannelInstance[]
}

export interface AccountModel extends AccountClass, Sequelize.Model<AccountInstance, AccountAttributes> {}
