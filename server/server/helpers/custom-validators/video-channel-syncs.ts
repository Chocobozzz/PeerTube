import { VIDEO_CHANNEL_SYNC_STATE } from '@server/initializers/constants.js'
import { exists } from './misc.js'

export function isVideoChannelSyncStateValid (value: any) {
  return exists(value) && VIDEO_CHANNEL_SYNC_STATE[value] !== undefined
}
