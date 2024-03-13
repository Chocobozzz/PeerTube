export const FileStorage = {
  FILE_SYSTEM: 0,
  OBJECT_STORAGE: 1
} as const

export type FileStorageType = typeof FileStorage[keyof typeof FileStorage]
