import { ServerBlocklistModel } from '@server/models/server/server-blocklist'
import { PickWith } from '@server/typings/utils'
import { MAccountDefault, MServer } from '@server/typings/models'

export type MServerBlocklist = Omit<ServerBlocklistModel, 'ByAccount' | 'BlockedServer'>

export type MServerBlocklistAccountServer = MServerBlocklist &
  PickWith<ServerBlocklistModel, 'ByAccount', MAccountDefault> &
  PickWith<ServerBlocklistModel, 'BlockedServer', MServer>
