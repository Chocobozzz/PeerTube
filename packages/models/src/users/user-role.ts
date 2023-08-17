// Always keep this order to prevent security issue since we store these values in the database
export const UserRole = {
  ADMINISTRATOR: 0,
  MODERATOR: 1,
  USER: 2
} as const

export type UserRoleType = typeof UserRole[keyof typeof UserRole]
