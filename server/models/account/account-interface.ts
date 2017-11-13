import * as Bluebird from 'bluebird'
import * as Sequelize from 'sequelize'
import { Account as FormattedAccount, ActivityPubActor } from '../../../shared'
import { ResultList } from '../../../shared/models/result-list.model'
import { PodInstance } from '../pod/pod-interface'
import { VideoChannelInstance } from '../video/video-channel-interface'

export namespace AccountMethods {
  export type LoadApplication = () => Bluebird<AccountInstance>

  export type Load = (id: number) => Bluebird<AccountInstance>
  export type LoadByUUID = (uuid: string) => Bluebird<AccountInstance>
  export type LoadByUrl = (url: string, transaction?: Sequelize.Transaction) => Bluebird<AccountInstance>
  export type LoadAccountByPodAndUUID = (uuid: string, podId: number, transaction: Sequelize.Transaction) => Bluebird<AccountInstance>
  export type LoadLocalAccountByNameAndPod = (name: string, host: string) => Bluebird<AccountInstance>
  export type ListOwned = () => Bluebird<AccountInstance[]>
  export type ListFollowerUrlsForApi = (id: number, start: number, count?: number) => Promise< ResultList<string> >
  export type ListFollowingUrlsForApi = (id: number, start: number, count?: number) => Promise< ResultList<string> >
  export type ListFollowingForApi = (id: number, start: number, count: number, sort: string) => Bluebird< ResultList<AccountInstance> >
  export type ListFollowersForApi = (id: number, start: number, count: number, sort: string) => Bluebird< ResultList<AccountInstance> >

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
  loadAccountByPodAndUUID: AccountMethods.LoadAccountByPodAndUUID
  load: AccountMethods.Load
  loadByUUID: AccountMethods.LoadByUUID
  loadByUrl: AccountMethods.LoadByUrl
  loadLocalAccountByNameAndPod: AccountMethods.LoadLocalAccountByNameAndPod
  listOwned: AccountMethods.ListOwned
  listFollowerUrlsForApi: AccountMethods.ListFollowerUrlsForApi
  listFollowingUrlsForApi: AccountMethods.ListFollowingUrlsForApi
  listFollowingForApi: AccountMethods.ListFollowingForApi
  listFollowersForApi: AccountMethods.ListFollowersForApi
}

export interface AccountAttributes {
  name: string
  url: string
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

  podId?: number
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

  Pod: PodInstance
  VideoChannels: VideoChannelInstance[]
}

export interface AccountModel extends AccountClass, Sequelize.Model<AccountInstance, AccountAttributes> {}
