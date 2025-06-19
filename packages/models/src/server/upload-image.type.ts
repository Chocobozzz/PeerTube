export const UploadImageType = {
  INSTANCE_FAVICON: 1,
  INSTANCE_HEADER_WIDE: 2,
  INSTANCE_HEADER_SQUARE: 3,
  INSTANCE_OPENGRAPH: 4
} as const

export type UploadImageType_Type = typeof UploadImageType[keyof typeof UploadImageType]
