import { UserRole } from './user-role'
import { UserAdminFlag } from './user-flag.model'

export interface UserUpdate {
  password?: string
  email?: string
  emailVerified?: boolean
  videoQuota?: number
  videoQuotaDaily?: number
  role?: UserRole
  adminFlags?: UserAdminFlag
}
