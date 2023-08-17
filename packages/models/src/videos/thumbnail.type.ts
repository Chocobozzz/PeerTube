export const ThumbnailType = {
  MINIATURE: 1,
  PREVIEW: 2
} as const

export type ThumbnailType_Type = typeof ThumbnailType[keyof typeof ThumbnailType]
