import { UserRole } from './user-role'

export interface UserUpdate {
  password?: string
  email?: string
  emailVerified?: boolean
  videoQuota?: number
  videoQuotaDaily?: number
  role?: UserRole
}
