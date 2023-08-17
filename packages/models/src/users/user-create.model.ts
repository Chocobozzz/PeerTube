import { UserAdminFlagType } from './user-flag.model.js'
import { UserRoleType } from './user-role.js'

export interface UserCreate {
  username: string
  password: string
  email: string
  videoQuota: number
  videoQuotaDaily: number
  role: UserRoleType
  adminFlags?: UserAdminFlagType
  channelName?: string
}
