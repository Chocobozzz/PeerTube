import { StreamSyncState, StreamSyncStateType } from '@peertube/peertube-models'

const STATE_CLASS_BY_ID = {
  [StreamSyncState.FAILED]: 'badge-red',
  [StreamSyncState.PROCESSING]: 'badge-blue',
  [StreamSyncState.SYNCED]: 'badge-green',
  [StreamSyncState.WAITING_FIRST_RUN]: 'badge-yellow'
}

export function getStateBadgeClasses (stateId: StreamSyncStateType) {
  return [ 'pt-badge', STATE_CLASS_BY_ID[stateId] ]
}
