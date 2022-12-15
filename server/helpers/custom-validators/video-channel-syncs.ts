import { VIDEO_CHANNEL_SYNC_STATE } from '@server/initializers/constants'
import { exists } from './misc'

export function isVideoChannelSyncStateValid (value: any) {
  return exists(value) && VIDEO_CHANNEL_SYNC_STATE[value] !== undefined
}
