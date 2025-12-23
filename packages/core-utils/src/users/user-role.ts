import { UserRight, UserRightType, UserRole, UserRoleType } from '@peertube/peertube-models'

export const USER_ROLE_LABELS: { [ id in UserRoleType ]: string } = {
  [UserRole.USER]: 'User',
  [UserRole.MODERATOR]: 'Moderator',
  [UserRole.ADMINISTRATOR]: 'Administrator'
}

const userRoleRights: { [ id in UserRoleType ]: UserRightType[] } = {
  [UserRole.ADMINISTRATOR]: [
    UserRight.ALL
  ],

  [UserRole.MODERATOR]: [
    UserRight.MANAGE_VIDEO_BLACKLIST,
    UserRight.MANAGE_ABUSES,
    UserRight.MANAGE_ANY_VIDEO_CHANNEL,
    UserRight.REMOVE_ANY_VIDEO,
    UserRight.REMOVE_ANY_VIDEO_PLAYLIST,
    UserRight.MANAGE_ANY_VIDEO_COMMENT,
    UserRight.UPDATE_ANY_VIDEO,
    UserRight.SEE_ALL_VIDEOS,
    UserRight.MANAGE_ACCOUNTS_BLOCKLIST,
    UserRight.MANAGE_SERVERS_BLOCKLIST,
    UserRight.MANAGE_USERS,
    UserRight.SEE_ALL_COMMENTS,
    UserRight.MANAGE_REGISTRATIONS,
    UserRight.MANAGE_INSTANCE_WATCHED_WORDS,
    UserRight.MANAGE_INSTANCE_AUTO_TAGS
  ],

  [UserRole.USER]: []
}

export function hasUserRight (userRole: UserRoleType, userRight: UserRightType) {
  const userRights = userRoleRights[userRole]

  return userRights.includes(UserRight.ALL) || userRights.includes(userRight)
}
