import { ConstantLabel } from '../common/constant-label.model.js'
import { StreamSyncStateType } from '../common/stream-sync-state.enum.js'

export interface WatchedWordsSubscription {
  id: number
  name: string
  url: string

  importedWordsCount: number

  lastSyncAt: Date | string
  state: ConstantLabel<StreamSyncStateType>

  createdAt: Date | string
  updatedAt: Date | string
}
