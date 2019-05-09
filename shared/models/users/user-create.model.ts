import { UserRole } from './user-role'
import { UserAdminFlag } from './user-flag.model'

export interface UserCreate {
  username: string
  password: string
  email: string
  videoQuota: number
  videoQuotaDaily: number
  role: UserRole
  adminFlags?: UserAdminFlag
}
