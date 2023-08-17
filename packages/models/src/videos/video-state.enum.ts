export const VideoState = {
  PUBLISHED: 1,
  TO_TRANSCODE: 2,
  TO_IMPORT: 3,
  WAITING_FOR_LIVE: 4,
  LIVE_ENDED: 5,
  TO_MOVE_TO_EXTERNAL_STORAGE: 6,
  TRANSCODING_FAILED: 7,
  TO_MOVE_TO_EXTERNAL_STORAGE_FAILED: 8,
  TO_EDIT: 9
} as const

export type VideoStateType = typeof VideoState[keyof typeof VideoState]
