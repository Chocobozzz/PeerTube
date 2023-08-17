export const ActorImageType = {
  AVATAR: 1,
  BANNER: 2
} as const

export type ActorImageType_Type = typeof ActorImageType[keyof typeof ActorImageType]
