import { UserRole } from './user-role'

export interface UserUpdate {
  email?: string
  videoQuota?: number
  role?: UserRole
}
