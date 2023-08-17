export const VideoImportState = {
  PENDING: 1,
  SUCCESS: 2,
  FAILED: 3,
  REJECTED: 4,
  CANCELLED: 5,
  PROCESSING: 6
} as const

export type VideoImportStateType = typeof VideoImportState[keyof typeof VideoImportState]
