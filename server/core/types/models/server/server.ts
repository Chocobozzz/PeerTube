import { FunctionProperties, PickWith } from '@peertube/peertube-typescript-utils'
import { ServerModel } from '../../../models/server/server.js'
import { MAccountBlocklistId } from '../account/index.js'

type Use<K extends keyof ServerModel, M> = PickWith<ServerModel, K, M>

// ############################################################################

export type MServer = Omit<ServerModel, 'Actors' | 'BlockedByAccounts'>

// ############################################################################

export type MServerHost = Pick<MServer, 'host'>
export type MServerRedundancyAllowed = Pick<MServer, 'redundancyAllowed'>

export type MServerHostBlocks =
  MServerHost &
  Use<'BlockedBy', MAccountBlocklistId[]>

// ############################################################################

// Format for API or AP object

export type MServerFormattable =
  FunctionProperties<MServer> &
  Pick<MServer, 'host'>
