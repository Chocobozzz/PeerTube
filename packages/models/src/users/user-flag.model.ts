export const UserAdminFlag = {
  NONE: 0,
  BYPASS_VIDEO_AUTO_BLACKLIST: 1 << 0
} as const

export type UserAdminFlagType = typeof UserAdminFlag[keyof typeof UserAdminFlag]
