export const VideoStorage = {
  FILE_SYSTEM: 0,
  OBJECT_STORAGE: 1
} as const

export type VideoStorageType = typeof VideoStorage[keyof typeof VideoStorage]
