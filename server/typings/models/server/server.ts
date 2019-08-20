import { ServerModel } from '../../../models/server/server'
import { PickWith } from '../../utils'
import { MAccountBlocklistId } from '../account'

type Use<K extends keyof ServerModel, M> = PickWith<ServerModel, K, M>

// ############################################################################

export type MServer = Omit<ServerModel, 'Actors' | 'BlockedByAccounts'>

// ############################################################################

export type MServerHost = Pick<MServer, 'host'>

export type MServerHostBlocks = MServerHost &
  Use<'BlockedByAccounts', MAccountBlocklistId[]>
