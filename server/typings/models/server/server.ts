import { ServerModel } from '../../../models/server/server'
import { PickWith } from '../../utils'
import { MAccountBlocklistId } from '../account'

export type MServer = Omit<ServerModel, 'Actors' | 'BlockedByAccounts'>

export type MServerHost = Pick<MServer, 'host'>

export type MServerHostBlocks = MServerHost &
  PickWith<ServerModel, 'BlockedByAccounts', MAccountBlocklistId[]>
