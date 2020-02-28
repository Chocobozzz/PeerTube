import { UserRight } from './user-right.enum'

// Keep the order
export enum UserRole {
  ADMINISTRATOR = 0,
  MODERATOR = 1,
  USER = 2
}

export const USER_ROLE_LABELS: { [ id in UserRole ]: string } = {
  [UserRole.USER]: 'User',
  [UserRole.MODERATOR]: 'Moderator',
  [UserRole.ADMINISTRATOR]: 'Administrator'
}

const userRoleRights: { [ id in UserRole ]: UserRight[] } = {
  [UserRole.ADMINISTRATOR]: [
    UserRight.ALL
  ],

  [UserRole.MODERATOR]: [
    UserRight.MANAGE_VIDEO_BLACKLIST,
    UserRight.MANAGE_VIDEO_ABUSES,
    UserRight.REMOVE_ANY_VIDEO,
    UserRight.REMOVE_ANY_VIDEO_CHANNEL,
    UserRight.REMOVE_ANY_VIDEO_PLAYLIST,
    UserRight.REMOVE_ANY_VIDEO_COMMENT,
    UserRight.UPDATE_ANY_VIDEO,
    UserRight.SEE_ALL_VIDEOS,
    UserRight.MANAGE_ACCOUNTS_BLOCKLIST,
    UserRight.MANAGE_SERVERS_BLOCKLIST,
    UserRight.MANAGE_USERS
  ],

  [UserRole.USER]: []
}

export function hasUserRight (userRole: UserRole, userRight: UserRight) {
  const userRights = userRoleRights[userRole]

  return userRights.includes(UserRight.ALL) || userRights.includes(userRight)
}
