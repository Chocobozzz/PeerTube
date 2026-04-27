import { BlocklistSubscriptionModel } from '@server/models/blocklist/blocklist-subscription.js'

export type MBlocklistSubscription = Omit<BlocklistSubscriptionModel, 'AccountBlocklists' | 'ServerBlocklists' | 'BlocklistLogs'>
