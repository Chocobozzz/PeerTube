import { ServerModel } from '../../../models/server/server'
import { FunctionProperties, PickWith } from '@shared/core-utils'
import { MAccountBlocklistId } from '../account'

type Use<K extends keyof ServerModel, M> = PickWith<ServerModel, K, M>

// ############################################################################

export type MServer = Omit<ServerModel, 'Actors' | 'BlockedByAccounts'>

// ############################################################################

export type MServerHost = Pick<MServer, 'host'>
export type MServerRedundancyAllowed = Pick<MServer, 'redundancyAllowed'>

export type MServerHostBlocks =
  MServerHost &
  Use<'BlockedByAccounts', MAccountBlocklistId[]>

// ############################################################################

// Format for API or AP object

export type MServerFormattable =
  FunctionProperties<MServer> &
  Pick<MServer, 'host'>
