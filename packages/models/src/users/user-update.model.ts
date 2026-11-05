import { UserAdminFlagType } from './user-flag.model.js'
import { UserRoleType } from './user-role.js'

export interface UserUpdate {
  password?: string
  email?: string
  emailVerified?: boolean
  videoQuota?: number
  videoQuotaDaily?: number
  role?: UserRoleType
  adminFlags?: UserAdminFlagType
  pluginAuth?: string

  // Required to give the administrator role, or to change the password, email or auth plugin of an administrator
  currentPassword?: string
}
