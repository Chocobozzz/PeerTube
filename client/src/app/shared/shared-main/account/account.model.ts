import { Account as ServerAccount } from '@shared/models/actors/account.model'
import { Actor } from './actor.model'

export class Account extends Actor implements ServerAccount {
  displayName: string
  description: string
  nameWithHost: string
  nameWithHostForced: string
  mutedByUser: boolean
  mutedByInstance: boolean
  mutedServerByUser: boolean
  mutedServerByInstance: boolean

  userId?: number

  constructor (hash: ServerAccount) {
    super(hash)

    this.displayName = hash.displayName
    this.description = hash.description
    this.userId = hash.userId
    this.nameWithHost = Actor.CREATE_BY_STRING(this.name, this.host)
    this.nameWithHostForced = Actor.CREATE_BY_STRING(this.name, this.host, true)

    this.mutedByUser = false
    this.mutedByInstance = false
    this.mutedServerByUser = false
    this.mutedServerByInstance = false
  }
}
