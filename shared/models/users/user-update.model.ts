import { UserRole } from './user-role'

export interface UserUpdate {
  email?: string
  emailVerified?: boolean
  videoQuota?: number
  videoQuotaDaily?: number
  role?: UserRole
}
