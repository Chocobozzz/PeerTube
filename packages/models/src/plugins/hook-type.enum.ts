export const HookType = {
  STATIC: 1,
  ACTION: 2,
  FILTER: 3
} as const

export type HookType_Type = typeof HookType[keyof typeof HookType]
