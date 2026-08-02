import { BlocklistLogModel } from '@server/models/blocklist/blocklist-log.js'

export type MBlocklistLog = Omit<BlocklistLogModel, 'Account' | 'BlocklistSubscription'>
