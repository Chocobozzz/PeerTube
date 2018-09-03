import { UserRole } from './user-role'

export interface UserUpdate {
  email?: string
  videoQuota?: number
  videoQuotaDaily?: number
  role?: UserRole
}
