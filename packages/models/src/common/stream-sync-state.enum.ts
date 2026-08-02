export const StreamSyncState = {
  WAITING_FIRST_RUN: 1,
  PROCESSING: 2,
  SYNCED: 3,
  FAILED: 4
} as const

export type StreamSyncStateType = typeof StreamSyncState[keyof typeof StreamSyncState]
