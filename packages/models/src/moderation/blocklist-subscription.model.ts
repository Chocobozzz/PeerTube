import { ConstantLabel } from '../common/constant-label.model.js'
import { StreamSyncStateType } from '../common/stream-sync-state.enum.js'

export interface BlocklistSubscription {
  id: number
  name: string
  url: string

  lastSyncAt: Date | string

  state: ConstantLabel<StreamSyncStateType>

  createdAt: Date | string
  updatedAt: Date | string

  mutedAccountsCount: number
  mutedServersCount: number
}
